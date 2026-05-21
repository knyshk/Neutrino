'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Shield, Eye, Pencil, Loader2, CheckCircle } from 'lucide-react'

interface AcceptInviteClientProps {
  token: string
  noteTitle: string
  ownerName: string | null
  invitedEmail: string | null
  permission: 'edit' | 'view'
  isLoggedIn: boolean
  userEmail: string | null
}

export function AcceptInviteClient({
  token,
  noteTitle,
  ownerName,
  invitedEmail,
  permission,
  isLoggedIn,
  userEmail,
}: AcceptInviteClientProps) {
  const router = useRouter()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/invite/${token}`)
      return
    }

    setAccepting(true)
    setError(null)

    try {
      const res = await fetch(`/api/invite/${token}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to accept invite')
        return
      }

      router.push(`/notes?note=${data.note_id}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-neutral-200 overflow-hidden">
        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-violet-600" />

        <div className="p-8 text-center space-y-5">
          {/* Icon */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
            <FileText size={24} className="text-violet-600" />
          </div>

          {/* Title */}
          <div className="space-y-1">
            <p className="text-xs text-neutral-500">
              {ownerName ? `${ownerName} shared a note with you` : "You've been invited to a note"}
            </p>
            <h1 className="text-lg font-semibold text-neutral-900 leading-tight">{noteTitle}</h1>
          </div>

          {/* Permission badge */}
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            permission === 'edit'
              ? 'bg-violet-50 text-violet-700'
              : 'bg-neutral-100 text-neutral-600'
          }`}>
            {permission === 'edit' ? <Pencil size={11} /> : <Eye size={11} />}
            {permission === 'edit' ? 'Can edit' : 'Can view'}
          </div>

          {/* User context */}
          {isLoggedIn && userEmail && (
            <p className="text-[11px] text-neutral-400">
              Accepting as <span className="font-medium text-neutral-600">{userEmail}</span>
            </p>
          )}

          {invitedEmail && !isLoggedIn && (
            <p className="text-[11px] text-neutral-400">
              Invited: <span className="font-medium">{invitedEmail}</span>
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* CTA */}
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-70"
          >
            {accepting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CheckCircle size={15} />
            )}
            {isLoggedIn ? 'Accept invite' : 'Sign in to accept'}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-400">
            <Shield size={10} />
            Secured by Neutrino
          </div>
        </div>
      </div>
    </div>
  )
}
