-- Run this on existing Neutrino databases to add Phase 5/6 features
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_notes_public ON notes(is_public) WHERE is_public = TRUE;
