import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chunkText } from '@/lib/ai/chunker'
import { embedTexts } from '@/lib/ai/embeddings'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  if (!file.extracted_text) {
    return NextResponse.json({ error: 'No extracted text available. Re-upload the file.' }, { status: 400 })
  }

  try {
    const chunks = chunkText(file.extracted_text, file.name, 'file')
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No content to embed' }, { status: 400 })
    }

    const embeddings = await embedTexts(chunks.map((c) => c.chunk_text))

    await supabase.from('chunks').delete().eq('file_id', id).eq('user_id', user.id)

    await supabase.from('chunks').insert(
      chunks.map((chunk, i) => ({
        user_id: user.id,
        file_id: id,
        source_title: file.name,
        source_type: 'file' as const,
        chunk_text: chunk.chunk_text,
        chunk_index: chunk.chunk_index,
        embedding: embeddings[i],
      }))
    )

    await supabase
      .from('files')
      .update({ extraction_status: 'done' })
      .eq('id', id)

    return NextResponse.json({ success: true, chunks_created: chunks.length })
  } catch (error) {
    return NextResponse.json({ error: 'Re-embed failed: ' + String(error) }, { status: 500 })
  }
}
