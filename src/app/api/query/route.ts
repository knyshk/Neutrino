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

  const systemPrompt = `You are Neutrino, a sharp and helpful AI assistant embedded in a personal knowledge workspace. You help users get insights from their own notes, meeting recordings, and uploaded documents.

Your style:
- Be direct, natural, and conversational — not robotic or template-driven
- Vary how you start answers; never begin with the same phrase twice
- When the content is rich, synthesize it into clear takeaways; don't just quote back the sources
- Use bullet points, headers, or prose depending on what fits best for the question
- Be analytical: if the user asks "what should I do" or "what's important", give your honest read of the material
- If something in the sources is surprising or worth highlighting, call it out

Rules:
1. Ground every answer in the provided sources — don't invent facts
2. If the sources don't have the answer, say so plainly and suggest what might help (upload a related doc, write a note about it, etc.)
3. Cite sources naturally inline, e.g. "According to your meeting notes…" or "(from: Project Brief)"
4. Keep answers focused. Long answers are fine when the question is complex, but don't pad.`

  const userMessage = `SOURCES:\n${sourcesContext}${historyText}\n\nQUESTION: ${question}`

  // Call Groq with streaming
  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.7,
      max_tokens: 1500,
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
