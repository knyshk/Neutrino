import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chunkText } from '@/lib/ai/chunker'
import { embedTexts } from '@/lib/ai/embeddings'
import { fetchWithRetry } from '@/lib/utils'

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

  const { data: recording, error: fetchError } = await supabase
    .from('recordings')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !recording) {
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }

  if (!recording.audio_url) {
    return NextResponse.json({ error: 'No audio file found for this recording' }, { status: 400 })
  }

  // Mark as processing
  await supabase
    .from('recordings')
    .update({ transcription_status: 'processing', transcription_error: null })
    .eq('id', id)

  try {
    // Fetch audio from storage
    const audioRes = await fetch(recording.audio_url)
    if (!audioRes.ok) throw new Error('Could not fetch audio from storage')

    const audioBuffer = await audioRes.arrayBuffer()
    const ext = recording.audio_url.includes('.webm') ? 'webm' : recording.audio_url.includes('.ogg') ? 'ogg' : 'mp4'
    const mimeType = ext === 'webm' ? 'audio/webm' : ext === 'ogg' ? 'audio/ogg' : 'audio/mp4'

    const whisperFormData = new FormData()
    const audioBlob = new Blob([audioBuffer], { type: mimeType })
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

    await supabase
      .from('recordings')
      .update({ transcript, transcription_status: 'done', updated_at: new Date().toISOString() })
      .eq('id', id)

    // Update or create note
    const { data: existingNote } = await supabase
      .from('notes')
      .select('id')
      .eq('recording_id', id)
      .eq('user_id', user.id)
      .single()

    let note = null
    if (existingNote) {
      const { data } = await supabase
        .from('notes')
        .update({ content_text: transcript, updated_at: new Date().toISOString() })
        .eq('id', existingNote.id)
        .select()
        .single()
      note = data
    } else {
      const { data } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
          title: recording.title,
          content: null,
          content_text: transcript,
          source_type: 'recording',
          recording_id: id,
        })
        .select()
        .single()
      note = data
    }

    // Re-embed in background
    embedInBackground(supabase, id, user.id, recording.title, transcript)

    return NextResponse.json({ recording: { ...recording, transcription_status: 'done', transcript }, note })
  } catch (error) {
    const errorMessage = String(error)
    await supabase
      .from('recordings')
      .update({ transcription_status: 'failed', transcription_error: errorMessage })
      .eq('id', id)

    return NextResponse.json({ error: 'Retry failed: ' + errorMessage }, { status: 500 })
  }
}

async function embedInBackground(
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
    await supabase.from('chunks').insert(
      chunks.map((chunk, i) => ({
        user_id: userId,
        recording_id: recordingId,
        source_title: title,
        source_type: 'recording' as const,
        chunk_text: chunk.chunk_text,
        chunk_index: chunk.chunk_index,
        embedding: embeddings[i],
      }))
    )
  } catch { /* non-critical */ }
}
