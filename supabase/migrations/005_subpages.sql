ALTER TABLE notes ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES notes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notes_parent_id ON notes(parent_id);
