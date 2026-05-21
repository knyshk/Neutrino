import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedTexts } from '@/lib/ai/embeddings'
import { generateSuggestedQuestions } from '@/lib/ai/rag'
import { rateLimit } from '@/lib/rate-limit'
import { AIMessage, ChunkWithSimilarity, SourceAttribution } from '@/types'

const SIMILARITY_THRESHOLD = 0.65
const MAX_CHUNKS = 8
const LLM_MODEL = 'llama-3.3-70b-versatile'

const NO_CONTEXT_ANSWER = (question: string) =>
  `I couldn't find information about "${question}" in your notes or documents.\n\nThis could mean:\n• The topic isn't covered in your uploaded content\n• Try rephrasing your question\n• Upload a document that covers this topic`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 30 queries per minute per user
  const rl = rateLimit(`query:${user.id}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const body = await request.json()
  const question: string = body.question?.trim()
  const conversationHistory: AIMessage[] = body.conversation_history || []
  const scopeType: string = body.scope_type || 'all'
  const scopeId: string | null = body.scope_id || null

  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  // Embed the question
  const [queryEmbedding] = await embedTexts([question])

  // Vector similarity search
  const { data: chunks, error: searchError } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    user_id_param: user.id,
    match_count: MAX_CHUNKS,
    scope_type_param: scopeType === 'all' ? null : scopeType,
    scope_id_param: scopeId,
  })

  if (searchError) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  const typedChunks: ChunkWithSimilarity[] = (chunks || []).map(
    (c: { chunk_text: string; source_title: string; source_type: string; note_id: string | null; recording_id: string | null; file_id: string | null; similarity: number }) => ({
      chunk_text: c.chunk_text,
      source_title: c.source_title,
      source_type: c.source_type as 'note' | 'recording' | 'file',
      note_id: c.note_id,
      recording_id: c.recording_id,
      file_id: c.file_id,
      similarity: c.similarity,
    })
  )

  const aboveThreshold = typedChunks.filter((c) => c.similarity >= SIMILARITY_THRESHOLD)

  // Build sources for attribution
  const sources: SourceAttribution[] = deduplicateSources(aboveThreshold.slice(0, MAX_CHUNKS))

  // No relevant content found — stream a canned response
  if (aboveThreshold.length === 0) {
    const answer = NO_CONTEXT_ANSWER(question)
    return streamText(answer, [], false)
  }

  const topChunks = aboveThreshold.slice(0, MAX_CHUNKS)

  const sourcesContext = topChunks
    .map((c) => `---\nSource: ${c.source_title} (${c.source_type})\n${c.chunk_text}\n---`)
    .join('\n\n')

  const historyText =
    conversationHistory.length > 0
      ? `\nPREVIOUS CONVERSATION:\n${conversationHistory
          .slice(-10)
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n')}`
      : ''

  const systemPrompt = `You are Neutrino, an AI assistant that helps users understand their own notes, meeting recordings, and uploaded documents.

CRITICAL RULES — follow these without exception:
1. Answer ONLY using information from the provided sources below.
2. If the answer is not present in the sources, say: "I couldn't find information about this in your notes."
3. Never use your general training knowledge to fill gaps.
4. Always cite which source(s) your answer comes from using the format: [Source: <source_title>]
5. Keep answers concise and structured. Use bullet points for lists.`

  const userMessage = `SOURCES:\n${sourcesContext}${historyText}\n\nUSER QUESTION:\n${question}`

  // Call Groq with streaming
  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.2,
      max_tokens: 1000,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!groqRes.ok) {
    const err = await groqRes.text()
    return NextResponse.json({ error: `LLM error: ${groqRes.status} — ${err}` }, { status: 500 })
  }

  console.log(
    JSON.stringify({
      event: 'ai_query',
      user_id: user.id,
      chunks_retrieved: typedChunks.length,
      max_similarity: typedChunks[0]?.similarity ?? 0,
      threshold_passed: true,
      timestamp: new Date().toISOString(),
    })
  )

  return streamFromGroq(groqRes, sources)
}

function streamFromGroq(groqRes: Response, sources: SourceAttribution[]): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // First event: send sources metadata so the client can show them immediately
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'meta', sources })}\n\n`)
      )

      const reader = groqRes.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const token = json.choices?.[0]?.delta?.content
            if (token) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`)
              )
            }
          } catch { /* malformed chunk — skip */ }
        }
      }

      controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function streamText(text: string, sources: SourceAttribution[], thresholdPassed: boolean): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'meta', sources, threshold_passed: thresholdPassed })}\n\n`)
      )
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'token', content: text })}\n\n`)
      )
      controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function deduplicateSources(chunks: ChunkWithSimilarity[]): SourceAttribution[] {
  const seen = new Map<string, SourceAttribution>()
  for (const chunk of chunks) {
    const sourceId = chunk.note_id || chunk.recording_id || chunk.file_id || ''
    if (!seen.has(sourceId)) {
      seen.set(sourceId, {
        source_title: chunk.source_title,
        source_type: chunk.source_type,
        source_id: sourceId,
        chunk_text: chunk.chunk_text,
        similarity: chunk.similarity,
      })
    }
  }
  return Array.from(seen.values())
}
