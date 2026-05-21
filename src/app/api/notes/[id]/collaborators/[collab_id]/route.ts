import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string; collab_id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, collab_id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { permission } = body

  if (!permission || !['edit', 'view'].includes(permission)) {
    return NextResponse.json({ error: 'Permission must be edit or view' }, { status: 400 })
  }

  // Verify ownership via user-scoped client
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (noteError || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  if (note.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const serviceClient = await createServiceClient()

  const { data: collaborator, error } = await serviceClient
    .from('collaborators')
    .update({ permission })
    .eq('id', collab_id)
    .eq('note_id', id)
    .select()
    .single()

  if (error || !collaborator) {
    return NextResponse.json({ error: error?.message ?? 'Collaborator not found' }, { status: 404 })
  }

  return NextResponse.json({ collaborator })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id, collab_id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = await createServiceClient()

  // Fetch the collaborator row first
  const { data: collaborator, error: fetchError } = await serviceClient
    .from('collaborators')
    .select('id, note_id, user_id')
    .eq('id', collab_id)
    .eq('note_id', id)
    .single()

  if (fetchError || !collaborator) {
    return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 })
  }

  // Check: user must be note owner OR the collaborator themselves
  const { data: note } = await supabase
    .from('notes')
    .select('user_id')
    .eq('id', id)
    .single()

  const isOwner = note?.user_id === user.id
  const isSelf = collaborator.user_id === user.id

  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteError } = await serviceClient
    .from('collaborators')
    .delete()
    .eq('id', collab_id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
