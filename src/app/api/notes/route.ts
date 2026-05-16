import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chunkText, extractPlainText } from '@/lib/ai/chunker'
import { embedTexts } from '@/lib/ai/embeddings'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: notes, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notes })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const title = body.title || 'Untitled Note'

  const { data: note, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title,
      content: null,
      content_text: null,
      source_type: 'manual',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ note }, { status: 201 })
}
