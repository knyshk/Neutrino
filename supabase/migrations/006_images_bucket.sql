-- Create images bucket for note images
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can upload/read/delete their own images (path starts with user_id/)
CREATE POLICY "Users can upload own images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can read images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');

CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);
