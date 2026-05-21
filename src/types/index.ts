export interface UserProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: Record<string, unknown> | null
  content_text: string | null
  source_type: 'manual' | 'recording' | 'upload'
  recording_id: string | null
  file_id: string | null
  is_deleted: boolean
  is_shared?: boolean
  is_public?: boolean
  created_at: string
  updated_at: string
}

export interface Recording {
  id: string
  user_id: string
  title: string
  audio_url: string | null
  duration_seconds: number | null
  transcript: string | null
  transcription_status: 'pending' | 'processing' | 'done' | 'failed'
  transcription_error: string | null
  file_size_bytes: number | null
  created_at: string
  updated_at: string
}

export interface UploadedFile {
  id: string
  user_id: string
  name: string
  file_type: 'pdf' | 'docx' | 'txt'
  storage_url: string
  extraction_status: 'pending' | 'done' | 'failed'
  extraction_error: string | null
  extracted_text: string | null
  file_size_bytes: number | null
  created_at: string
}

export interface Chunk {
  id: string
  user_id: string
  note_id: string | null
  recording_id: string | null
  file_id: string | null
  source_title: string
  source_type: 'note' | 'recording' | 'file'
  chunk_text: string
  chunk_index: number
  embedding: number[] | null
  created_at: string
}

export interface Collaborator {
  id: string
  note_id: string
  invited_email: string | null
  user_id: string | null
  permission: 'edit' | 'view'
  invite_token: string | null
  accepted_at: string | null
  created_at: string
}

export interface AISession {
  id: string
  user_id: string
  messages: AIMessage[]
  scope_type: 'all' | 'note' | 'recording' | 'file'
  scope_id: string | null
  created_at: string
  updated_at: string
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceAttribution[]
  created_at: string
}

export interface SourceAttribution {
  source_title: string
  source_type: 'note' | 'recording' | 'file'
  source_id: string
  chunk_text: string
  similarity: number
}

export interface ChunkWithSimilarity {
  chunk_text: string
  source_title: string
  source_type: 'note' | 'recording' | 'file'
  note_id: string | null
  recording_id: string | null
  file_id: string | null
  similarity: number
}

export interface APIError {
  error: string
  details?: string
}
