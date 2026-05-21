import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { chunkText, extractPlainText } from '@/lib/ai/chunker'
import { embedTexts } from '@/lib/ai/embeddings'
import { rateLimit } from '@/lib/rate-limit'
import type { Note } from '@/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const includeDeleted = searchParams.get('include_deleted') === 'true'

  let query = supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (includeDeleted) {
    query = query.eq('is_deleted', true)
  } else {
    query = query.eq('is_deleted', false)
  }

  const { data: ownNotes, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch notes shared with the user via accepted collaborator rows
  const serviceClient = await createServiceClient()

  const { data: collabRows } = await serviceClient
    .from('collaborators')
    .select('note_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)

  let sharedNotes: (Note & { is_shared?: boolean })[] = []

  if (collabRows && collabRows.length > 0) {
    const sharedNoteIds = collabRows.map((c: { note_id: string }) => c.note_id)

    let sharedQuery = serviceClient
      .from('notes')
      .select('*')
      .in('id', sharedNoteIds)

    if (includeDeleted) {
      sharedQuery = sharedQuery.eq('is_deleted', true)
    } else {
      sharedQuery = sharedQuery.eq('is_deleted', false)
    }

    const { data: fetchedShared } = await sharedQuery
    if (fetchedShared) {
      sharedNotes = fetchedShared.map((n: Note) => ({ ...n, is_shared: true }))
    }
  }

  // Merge own notes + shared notes, deduplicate by id, sort by updated_at DESC
  const ownNotesWithFlag: (Note & { is_shared?: boolean })[] = (ownNotes ?? []).map((n) => ({
    ...n,
    is_shared: false,
  }))

  const seenIds = new Set<string>()
  const merged: (Note & { is_shared?: boolean })[] = []

  for (const note of [...ownNotesWithFlag, ...sharedNotes]) {
    if (!seenIds.has(note.id)) {
      seenIds.add(note.id)
      merged.push(note)
    }
  }

  merged.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  return NextResponse.json({ notes: merged })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit(`notes:${user.id}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
      { status: 429 }
    )
  }

  const body = await request.json()
  const title = body.title || 'Untitled Note'

  const { data: note, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title,
      content: null,
      content_text: null,
      source_type: 'manual',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ note }, { status: 201 })
}
