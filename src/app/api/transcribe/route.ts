import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chunkText } from '@/lib/ai/chunker'
import { embedTexts } from '@/lib/ai/embeddings'
import { fetchWithRetry } from '@/lib/utils'

const MAX_AUDIO_SIZE = parseInt(process.env.MAX_AUDIO_SIZE_MB || '50') * 1024 * 1024
const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
]

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const audioFile = formData.get('audio') as File | null
  const title = (formData.get('title') as string) || 'Untitled Recording'

  if (!audioFile) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
  }

  // Validate it's actually audio
  if (!ALLOWED_AUDIO_TYPES.includes(audioFile.type) && !audioFile.type.startsWith('audio/')) {
    return NextResponse.json({ error: 'Invalid file type. Must be an audio file.' }, { status: 400 })
  }

  if (audioFile.size > MAX_AUDIO_SIZE) {
    return NextResponse.json(
      { error: `Audio too large. Maximum size is ${process.env.MAX_AUDIO_SIZE_MB || 50}MB.` },
      { status: 400 }
    )
  }

  const arrayBuffer = await audioFile.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload audio to Supabase Storage
  const ext = audioFile.type.includes('webm') ? 'webm' : audioFile.type.includes('ogg') ? 'ogg' : 'mp4'
  const storagePath = `${user.id}/${Date.now()}.${ext}`

  const { error: storageError } = await supabase.storage
    .from('recordings')
    .upload(storagePath, buffer, { contentType: audioFile.type, upsert: false })

  if (storageError) {
    return NextResponse.json({ error: `Storage error: ${storageError.message}` }, { status: 500 })
  }

  const { data: { publicUrl: audioUrl } } = supabase.storage.from('recordings').getPublicUrl(storagePath)

  // Create recording record with 'processing' status
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .insert({
      user_id: user.id,
      title,
      audio_url: audioUrl,
      transcription_status: 'processing',
      file_size_bytes: audioFile.size,
    })
    .select()
    .single()

  if (recordingError) {
    return NextResponse.json({ error: recordingError.message }, { status: 500 })
  }

  // Send to Groq Whisper for transcription
  try {
    const whisperFormData = new FormData()
    const audioBlob = new Blob([buffer], { type: audioFile.type })
    whisperFormData.append('file', audioBlob, `recording.${ext}`)
    whisperFormData.append('model', 'whisper-large-v3')
    whisperFormData.append('response_format', 'text')

    const transcribeResponse = await fetchWithRetry(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: whisperFormData,
      },
      3
    )

    if (!transcribeResponse.ok) {
      const errText = await transcribeResponse.text()
      throw new Error(`Whisper error: ${transcribeResponse.status} — ${errText}`)
    }

    const transcript = await transcribeResponse.text()

    // Update recording with transcript
    await supabase
      .from('recordings')
      .update({
        transcript,
        transcription_status: 'done',
        updated_at: new Date().toISOString(),
      })
      .eq('id', recording.id)

    // Create a note from the transcript
    const { data: note } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        title,
        content: null,
        content_text: transcript,
        source_type: 'recording',
        recording_id: recording.id,
      })
      .select()
      .single()

    // Embed the transcript
    embedTranscriptInBackground(supabase, recording.id, user.id, title, transcript)

    return NextResponse.json({ recording: { ...recording, transcription_status: 'done', transcript }, note })
  } catch (error) {
    const errorMessage = String(error)

    await supabase
      .from('recordings')
      .update({
        transcription_status: 'failed',
        transcription_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recording.id)

    return NextResponse.json(
      {
        error: 'Transcription failed. Your audio file has been saved and you can retry.',
        recording_id: recording.id,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: recordings, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ recordings })
}

async function embedTranscriptInBackground(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  recordingId: string,
  userId: string,
  title: string,
  text: string
) {
  try {
    const chunks = chunkText(text, title, 'recording')
    if (chunks.length === 0) return

    const embeddings = await embedTexts(chunks.map((c) => c.chunk_text))

    await supabase.from('chunks').delete().eq('recording_id', recordingId).eq('user_id', userId)

    const chunkRows = chunks.map((chunk, i) => ({
      user_id: userId,
      recording_id: recordingId,
      source_title: title,
      source_type: 'recording' as const,
      chunk_text: chunk.chunk_text,
      chunk_index: chunk.chunk_index,
      embedding: embeddings[i],
    }))

    await supabase.from('chunks').insert(chunkRows)
  } catch (error) {
    console.error(JSON.stringify({ event: 'embed_error', recording_id: recordingId, error: String(error) }))
  }
}
