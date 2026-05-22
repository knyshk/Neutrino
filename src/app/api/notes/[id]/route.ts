import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { chunkText, extractPlainText } from '@/lib/ai/chunker'
import { embedTexts } from '@/lib/ai/embeddings'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Try owner access first
  const { data: ownNote } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (ownNote) {
    return NextResponse.json({ note: ownNote })
  }

  // Fall back to collaborator access
  const serviceClient = await createServiceClient()

  const { data: collaborator } = await serviceClient
    .from('collaborators')
    .select('id, permission')
    .eq('note_id', id)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .single()

  if (!collaborator) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  const { data: note, error: noteError } = await serviceClient
    .from('notes')
    .select('*')
    .eq('id', id)
    .single()

  if (noteError || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  return NextResponse.json({ note })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Try owner update first
  const { data: ownNote } = await supabase
    .from('notes')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (ownNote) {
    // Owner can update all fields including is_deleted, is_public, and is_pinned
    const updates: Record<string, unknown> = {}
    if (body.is_deleted !== undefined) updates.is_deleted = body.is_deleted
    if (body.is_public !== undefined) updates.is_public = Boolean(body.is_public)
    if (body.is_pinned !== undefined) updates.is_pinned = Boolean(body.is_pinned)
    if ('color' in body) updates.color = body.color ?? null
    if (body.title !== undefined) updates.title = body.title
    if (body.content !== undefined) {
      updates.content = body.content
      updates.content_text =
        body.content_text ?? (body.content ? extractPlainText(body.content) : null)
    }

    const { data: note, error } = await supabase
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !note) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    if (body.content && note.content_text) {
      embedNoteInBackground(supabase, note.id, user.id, note.title, note.content_text)
    }

    return NextResponse.json({ note })
  }

  // Fall back to collaborator access — edit permission required
  const serviceClient = await createServiceClient()

  const { data: collaborator } = await serviceClient
    .from('collaborators')
    .select('id, permission')
    .eq('note_id', id)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .single()

  if (!collaborator) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  if (collaborator.permission !== 'edit') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Collaborators can only update content/title, NOT is_deleted
  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.content !== undefined) {
    updates.content = body.content
    updates.content_text =
      body.content_text ?? (body.content ? extractPlainText(body.content) : null)
  }

  const { data: note, error } = await serviceClient
    .from('notes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !note) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  if (body.content && note.content_text) {
    embedNoteInBackground(serviceClient, note.id, note.user_id, note.title, note.content_text)
  }

  return NextResponse.json({ note })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Soft delete
  const { error } = await supabase
    .from('notes')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Remove chunks for this note
  await supabase.from('chunks').delete().eq('note_id', id).eq('user_id', user.id)

  return NextResponse.json({ success: true })
}

async function embedNoteInBackground(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  noteId: string,
  userId: string,
  title: string,
  text: string
) {
  try {
    const chunks = chunkText(text, title, 'note')
    if (chunks.length === 0) return

    const embeddings = await embedTexts(chunks.map((c) => c.chunk_text))

    // Delete existing chunks for this note
    await supabase.from('chunks').delete().eq('note_id', noteId).eq('user_id', userId)

    // Insert new chunks
    const chunkRows = chunks.map((chunk, i) => ({
      user_id: userId,
      note_id: noteId,
      source_title: title,
      source_type: 'note' as const,
      chunk_text: chunk.chunk_text,
      chunk_index: chunk.chunk_index,
      embedding: embeddings[i],
    }))

    await supabase.from('chunks').insert(chunkRows)
  } catch (error) {
    console.error(JSON.stringify({ event: 'embed_error', note_id: noteId, error: String(error) }))
  }
}
