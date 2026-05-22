import Link from 'next/link'
import { CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params
  const serviceClient = await createServiceClient()

  const { data: collaborator } = await serviceClient
    .from('collaborators')
    .select('id, note_id, invited_email, accepted_at, user_id')
    .eq('invite_token', token)
    .single()

  // Not found
  if (!collaborator) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
              <AlertCircle className="text-neutral-400" size={24} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Invite not found or expired</h2>
          <p className="text-sm text-neutral-500 mb-6">
            This invite link is invalid or has already been removed.
          </p>
          <Link
            href="/notes"
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            Go to workspace
          </Link>
        </div>
      </div>
    )
  }

  // Already accepted
  if (collaborator.accepted_at !== null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <CheckCircle className="text-green-600" size={24} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Already accepted</h2>
          <p className="text-sm text-neutral-500 mb-6">
            You have already accepted this invite. Head to your workspace to view the note.
          </p>
          <Link
            href="/notes"
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            Go to your workspace
          </Link>
        </div>
      </div>
    )
  }

  // Check if user is logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Accept the invite: update accepted_at and user_id if logged in
  await serviceClient
    .from('collaborators')
    .update({
      accepted_at: new Date().toISOString(),
      ...(user ? { user_id: user.id } : {}),
    })
    .eq('id', collaborator.id)

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-neutral-200 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-violet-600" />
        <div className="p-8 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
            <FileText size={24} className="text-violet-600" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-center mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <CheckCircle size={18} className="text-green-600" />
              </div>
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">Invite accepted!</h1>
            <p className="text-sm text-neutral-500">
              You now have access to the shared note.
            </p>
          </div>
          <Link
            href="/notes"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            Open your workspace
          </Link>
          {!user && (
            <p className="text-xs text-neutral-500">
              Don&apos;t have an account?{' '}
              <Link
                href={`/signup?redirect=/invite/${token}`}
                className="font-medium text-violet-600 hover:text-violet-700"
              >
                Sign up free
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
