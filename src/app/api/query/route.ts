import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embedTexts } from '@/lib/ai/embeddings'
import { queryRAG } from '@/lib/ai/rag'
import { AIMessage, ChunkWithSimilarity } from '@/types'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const question: string = body.question?.trim()
  const conversationHistory: AIMessage[] = body.conversation_history || []
  const scopeType: string = body.scope_type || 'all'
  const scopeId: string | null = body.scope_id || null

  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  try {
    // Embed the question
    const [queryEmbedding] = await embedTexts([question])

    // Vector similarity search via Supabase RPC
    const { data: chunks, error: searchError } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      user_id_param: user.id,
      match_count: 8,
      scope_type_param: scopeType === 'all' ? null : scopeType,
      scope_id_param: scopeId,
    })

    if (searchError) {
      console.error(JSON.stringify({ event: 'search_error', error: searchError.message }))
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

    const result = await queryRAG(question, typedChunks, conversationHistory)

    console.log(
      JSON.stringify({
        event: 'ai_query',
        user_id: user.id,
        chunks_retrieved: typedChunks.length,
        max_similarity: typedChunks[0]?.similarity ?? 0,
        threshold_passed: result.threshold_passed,
        response_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      })
    )

    return NextResponse.json({
      answer: result.answer,
      sources: result.sources,
      threshold_passed: result.threshold_passed,
    })
  } catch (error) {
    console.error(JSON.stringify({ event: 'query_error', error: String(error) }))
    return NextResponse.json({ error: 'Query failed. Please try again.' }, { status: 500 })
  }
}
