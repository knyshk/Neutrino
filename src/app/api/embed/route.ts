import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chunkText } from '@/lib/ai/chunker'
import { embedTexts } from '@/lib/ai/embeddings'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { text, source_id, source_type, source_title } = body

  if (!text || !source_id || !source_type || !source_title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['note', 'recording', 'file'].includes(source_type)) {
    return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 })
  }

  try {
    const chunks = chunkText(text, source_title, source_type)

    if (chunks.length === 0) {
      return NextResponse.json({ chunks_created: 0 })
    }

    const embeddings = await embedTexts(chunks.map((c) => c.chunk_text))

    // Remove existing chunks for this source
    const sourceField = `${source_type}_id`
    await supabase.from('chunks').delete().eq(sourceField, source_id).eq('user_id', user.id)

    const chunkRows = chunks.map((chunk, i) => ({
      user_id: user.id,
      [`${source_type}_id`]: source_id,
      source_title,
      source_type,
      chunk_text: chunk.chunk_text,
      chunk_index: chunk.chunk_index,
      embedding: embeddings[i],
    }))

    const { error: insertError } = await supabase.from('chunks').insert(chunkRows)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ chunks_created: chunks.length })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
