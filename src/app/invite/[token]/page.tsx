import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { AcceptInviteClient } from './accept-invite-client'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params
  const serviceClient = await createServiceClient()

  // Validate token server-side
  const { data: collaborator } = await serviceClient
    .from('collaborators')
    .select('*, notes(title, user_id)')
    .eq('invite_token', token)
    .single()

  if (!collaborator) {
    redirect('/login?error=invalid_invite')
  }

  // If already accepted, redirect to the note
  if (collaborator.accepted_at) {
    redirect(`/notes?note=${collaborator.note_id}`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const noteData = collaborator.notes as { title: string; user_id: string } | null

  // Get owner display name
  const { data: ownerProfile } = await serviceClient
    .from('user_profiles')
    .select('display_name')
    .eq('id', noteData?.user_id ?? '')
    .single()

  return (
    <AcceptInviteClient
      token={token}
      noteTitle={noteData?.title ?? 'Untitled Note'}
      ownerName={ownerProfile?.display_name ?? null}
      invitedEmail={collaborator.invited_email}
      permission={collaborator.permission as 'edit' | 'view'}
      isLoggedIn={!!user}
      userEmail={user?.email ?? null}
    />
  )
}
