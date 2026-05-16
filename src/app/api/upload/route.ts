import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chunkText } from '@/lib/ai/chunker'
import { embedTexts } from '@/lib/ai/embeddings'

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate MIME type server-side (not just extension)
  const fileType = ALLOWED_TYPES[file.type]
  if (!fileType) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload PDF, DOCX, or TXT files.' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB.` },
      { status: 400 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload raw file to Supabase Storage
  const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const { data: storageData, error: storageError } = await supabase.storage
    .from('documents')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (storageError) {
    return NextResponse.json({ error: `Storage error: ${storageError.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(storagePath)

  // Insert file record as 'pending'
  const { data: fileRecord, error: insertError } = await supabase
    .from('files')
    .insert({
      user_id: user.id,
      name: file.name,
      file_type: fileType,
      storage_url: publicUrl,
      extraction_status: 'pending',
      file_size_bytes: file.size,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Extract text
  let extractedText: string | null = null
  let extractionError: string | null = null

  try {
    if (fileType === 'txt') {
      extractedText = buffer.toString('utf-8')
    } else if (fileType === 'pdf') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule = await import('pdf-parse') as any
      const pdfParse = pdfParseModule.default ?? pdfParseModule
      const pdfData = await pdfParse(buffer)
      extractedText = pdfData.text
    } else if (fileType === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    }

    if (!extractedText || extractedText.trim().length < 50) {
      extractionError =
        fileType === 'pdf'
          ? 'Could not extract text from this PDF. It may be scanned or image-only.'
          : 'File appears to be empty or contains no readable text.'
      extractedText = null
    }
  } catch (err) {
    extractionError = `Text extraction failed: ${String(err)}`
    extractedText = null
  }

  // Update file record with extraction result
  await supabase
    .from('files')
    .update({
      extraction_status: extractedText ? 'done' : 'failed',
      extraction_error: extractionError,
      extracted_text: extractedText,
    })
    .eq('id', fileRecord.id)

  if (extractedText) {
    // Embed in background — don't await to avoid timeout
    embedFileInBackground(supabase, fileRecord.id, user.id, file.name, extractedText)
  }

  const updatedFile = {
    ...fileRecord,
    extraction_status: extractedText ? 'done' : 'failed',
    extraction_error: extractionError,
  }

  return NextResponse.json(
    { file: updatedFile, extraction_error: extractionError },
    { status: 201 }
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: files, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ files })
}

async function embedFileInBackground(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  fileId: string,
  userId: string,
  fileName: string,
  text: string
) {
  try {
    const chunks = chunkText(text, fileName, 'file')
    if (chunks.length === 0) return

    const embeddings = await embedTexts(chunks.map((c) => c.chunk_text))

    await supabase.from('chunks').delete().eq('file_id', fileId).eq('user_id', userId)

    const chunkRows = chunks.map((chunk, i) => ({
      user_id: userId,
      file_id: fileId,
      source_title: fileName,
      source_type: 'file' as const,
      chunk_text: chunk.chunk_text,
      chunk_index: chunk.chunk_index,
      embedding: embeddings[i],
    }))

    await supabase.from('chunks').insert(chunkRows)
  } catch (error) {
    console.error(JSON.stringify({ event: 'embed_error', file_id: fileId, error: String(error) }))
  }
}
