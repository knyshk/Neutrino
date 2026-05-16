import { fetchWithRetry } from '@/lib/utils'
import { ChunkWithSimilarity, AIMessage, SourceAttribution } from '@/types'

const LLM_MODEL = 'llama-3.3-70b-versatile'
const SIMILARITY_THRESHOLD = 0.65
const MAX_CHUNKS = 8

export interface RAGResult {
  answer: string
  sources: SourceAttribution[]
  threshold_passed: boolean
}

export async function queryRAG(
  question: string,
  chunks: ChunkWithSimilarity[],
  conversationHistory: AIMessage[] = []
): Promise<RAGResult> {
  const aboveThreshold = chunks.filter((c) => c.similarity >= SIMILARITY_THRESHOLD)

  if (aboveThreshold.length === 0) {
    return {
      answer: buildNoContextResponse(question),
      sources: [],
      threshold_passed: false,
    }
  }

  const topChunks = aboveThreshold.slice(0, MAX_CHUNKS)

  const sourcesContext = topChunks
    .map(
      (c) =>
        `---\nSource: ${c.source_title} (${c.source_type})\n${c.chunk_text}\n---`
    )
    .join('\n\n')

  const historyText =
    conversationHistory.length > 0
      ? `\nPREVIOUS CONVERSATION:\n${conversationHistory
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n')}`
      : ''

  const systemPrompt = `You are Neutrino, an AI assistant that helps users understand their own notes, meeting recordings, and uploaded documents.

CRITICAL RULES — follow these without exception:
1. Answer ONLY using information from the provided sources below.
2. If the answer is not present in the sources, respond with exactly: "I couldn't find information about this in your notes. Try uploading more relevant documents or checking a different note."
3. Never use your general training knowledge to fill gaps. If the sources are silent on a point, you are silent too.
4. Always cite which source(s) your answer comes from using the format: [Source: <source_title>]
5. If multiple sources contain relevant information, synthesize them but cite all of them.
6. Keep answers concise and structured. Use bullet points for lists.`

  const userMessage = `SOURCES:\n${sourcesContext}${historyText}\n\nUSER QUESTION:\n${question}`

  const response = await fetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.2,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    },
    3
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM API error: ${response.status} — ${error}`)
  }

  const data = await response.json()
  const answer = data.choices[0].message.content

  const uniqueSources = deduplicateSources(topChunks)

  return {
    answer,
    sources: uniqueSources,
    threshold_passed: true,
  }
}

export async function generateSummary(text: string): Promise<string> {
  const response = await fetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.3,
        max_tokens: 1500,
        messages: [
          {
            role: 'system',
            content:
              'You are a meeting assistant. Your job is to extract structured information from meeting transcripts. Be factual and precise. Do not invent details.',
          },
          {
            role: 'user',
            content: `Please create a structured summary of the following meeting transcript.

Format your response as:

## Meeting Summary
[2-3 sentence overview of what the meeting covered]

## Key Decisions Made
- [Decision 1]
(List only decisions explicitly made in the meeting. If none, write "No formal decisions recorded.")

## Action Items
- [ ] [Task description] — [Person responsible if mentioned] — [Deadline if mentioned]
(List concrete next steps mentioned. If none, write "No action items recorded.")

## Key Discussion Points
- [Topic 1]: [Brief summary of what was said]

## Open Questions / Unresolved Items
- [Question or unresolved item]
(If none, write "None identified.")

TRANSCRIPT:
${text}`,
          },
        ],
      }),
    },
    3
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM API error: ${response.status} — ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function generateSuggestedQuestions(contentPreview: string): Promise<string[]> {
  const response = await fetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `You are helping a user get the most from their notes. Generate exactly 5 questions they might want to ask about the content below. Questions should be specific and answerable from the content. Return ONLY a JSON array of 5 strings. No other text.`,
          },
          {
            role: 'user',
            content: `CONTENT:\n${contentPreview.slice(0, 1000)}`,
          },
        ],
      }),
    },
    3
  )

  if (!response.ok) return []

  try {
    const data = await response.json()
    const content = data.choices[0].message.content
    return JSON.parse(content)
  } catch {
    return []
  }
}

function buildNoContextResponse(question: string): string {
  return `I couldn't find information about "${question}" in your notes or documents.

This could mean:
• The topic isn't covered in your uploaded content
• Try rephrasing your question
• Upload a document that covers this topic`
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
