-- ============================================================
-- NEUTRINO — Full Database Schema
-- Run this in Supabase SQL Editor (top to bottom, once)
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- USER PROFILES (extends Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- RECORDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Recording',
  audio_url TEXT,
  duration_seconds INTEGER,
  transcript TEXT,
  transcription_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (transcription_status IN ('pending', 'processing', 'done', 'failed')),
  transcription_error TEXT,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id, created_at DESC);

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own recordings"
  ON recordings FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FILES
-- ============================================================
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt')),
  storage_url TEXT NOT NULL,
  extraction_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'done', 'failed')),
  extraction_error TEXT,
  extracted_text TEXT,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id, created_at DESC);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own files"
  ON files FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content JSONB,
  content_text TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'recording', 'upload')),
  recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_fts ON notes
  USING GIN(to_tsvector('english', COALESCE(content_text, '')));

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own notes"
  ON notes FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CHUNKS (Core RAG table)
-- ============================================================
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  source_title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'recording', 'file')),
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding VECTOR(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_user_id ON chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_note_id ON chunks(note_id) WHERE note_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own chunks"
  ON chunks FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- COLLABORATORS
-- ============================================================
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  invited_email TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('edit', 'view')),
  invite_token TEXT UNIQUE,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collaborators_note_id ON collaborators(note_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user_id ON collaborators(user_id);

ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Note owners can manage collaborators"
  ON collaborators FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = collaborators.note_id
        AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Collaborators can read own entries"
  ON collaborators FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- AI SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  scope_type TEXT NOT NULL DEFAULT 'all' CHECK (scope_type IN ('all', 'note', 'recording', 'file')),
  scope_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own sessions"
  ON ai_sessions FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding VECTOR(768),
  user_id_param UUID,
  match_count INTEGER DEFAULT 8,
  scope_type_param TEXT DEFAULT NULL,
  scope_id_param UUID DEFAULT NULL
)
RETURNS TABLE (
  chunk_text TEXT,
  source_title TEXT,
  source_type TEXT,
  note_id UUID,
  recording_id UUID,
  file_id UUID,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.chunk_text,
    c.source_title,
    c.source_type,
    c.note_id,
    c.recording_id,
    c.file_id,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM chunks c
  WHERE
    c.user_id = user_id_param
    AND (
      scope_type_param IS NULL
      OR (scope_type_param = 'note' AND c.note_id = scope_id_param)
      OR (scope_type_param = 'recording' AND c.recording_id = scope_id_param)
      OR (scope_type_param = 'file' AND c.file_id = scope_id_param)
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- STORAGE BUCKETS (run in Supabase dashboard Storage section)
-- Create buckets named: 'recordings' and 'documents'
-- Set them to private (not public)
-- Add RLS policies matching user_id in the path
-- ============================================================
