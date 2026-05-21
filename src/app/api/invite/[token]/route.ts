import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params
  const serviceClient = await createServiceClient()

  // Look up collaborator by invite_token
  const { data: collaborator, error } = await serviceClient
    .from('collaborators')
    .select('*')
    .eq('invite_token', token)
    .single()

  if (error || !collaborator) {
    return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 404 })
  }

  if (collaborator.accepted_at) {
    return NextResponse.json({ already_accepted: true, note_id: collaborator.note_id }, { status: 200 })
  }

  // Fetch note + owner info
  const { data: note, error: noteError } = await serviceClient
    .from('notes')
    .select('id, title, user_id')
    .eq('id', collaborator.note_id)
    .single()

  if (noteError || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  const { data: ownerProfile } = await serviceClient
    .from('user_profiles')
    .select('display_name')
    .eq('id', note.user_id)
    .single()

  return NextResponse.json({
    valid: true,
    note_title: note.title,
    note_id: note.id,
    invited_email: collaborator.invited_email,
    permission: collaborator.permission,
    owner_name: ownerProfile?.display_name ?? null,
    already_accepted: false,
  })
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = await createServiceClient()

  // Look up collaborator by invite_token
  const { data: collaborator, error } = await serviceClient
    .from('collaborators')
    .select('*')
    .eq('invite_token', token)
    .single()

  if (error || !collaborator) {
    return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 404 })
  }

  if (collaborator.accepted_at) {
    return NextResponse.json({ already_accepted: true, note_id: collaborator.note_id }, { status: 200 })
  }

  // Accept invite: set user_id and accepted_at
  const { error: updateError } = await serviceClient
    .from('collaborators')
    .update({
      user_id: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', collaborator.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    note_id: collaborator.note_id,
    permission: collaborator.permission,
  })
}
