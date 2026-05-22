import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('image') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG' }, { status: 400 })
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: 'Image too large. Maximum size is 10MB.' }, { status: 400 })
  }

  const ext = file.type.split('/')[1].replace('svg+xml', 'svg')
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
