'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, Loader2, Trash2, UserPlus, Shield, Eye } from 'lucide-react'
import { Collaborator } from '@/types'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface CollaboratorWithProfile extends Collaborator {
  display_name: string | null
}

interface ShareModalProps {
  noteId: string
  noteTitle: string
  onClose: () => void
}

export function ShareModal({ noteId, noteTitle, onClose }: ShareModalProps) {
  const { success, error: toastError } = useToast()
  const [collaborators, setCollaborators] = useState<CollaboratorWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'edit' | 'view'>('edit')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadCollaborators()
  }, [noteId])

  async function loadCollaborators() {
    setLoading(true)
    try {
      const res = await fetch(`/api/notes/${noteId}/collaborators`)
      if (res.ok) {
        const data = await res.json()
        setCollaborators(data.collaborators || [])
      }
    } catch { /* non-critical */ } finally {
      setLoading(false)
    }
  }

  async function handleInvite() {
    if (!email.trim()) return
    setInviting(true)
    try {
      const res = await fetch(`/api/notes/${noteId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), permission }),
      })
      const data = await res.json()
      if (!res.ok) {
        toastError(data.error || 'Failed to invite collaborator')
        return
      }
      setCollaborators((prev) => [...prev, data.collaborator])
      setInviteLink(data.invite_link)
      setEmail('')
      success('Invite created — copy the link to share')
    } catch {
      toastError('Failed to invite collaborator')
    } finally {
      setInviting(false)
    }
  }

  async function handlePermissionChange(collabId: string, newPermission: 'edit' | 'view') {
    try {
      const res = await fetch(`/api/notes/${noteId}/collaborators/${collabId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: newPermission }),
      })
      if (res.ok) {
        setCollaborators((prev) =>
          prev.map((c) => c.id === collabId ? { ...c, permission: newPermission } : c)
        )
        success('Permission updated')
      }
    } catch {
      toastError('Failed to update permission')
    }
  }

  async function handleRemove(collabId: string) {
    try {
      const res = await fetch(`/api/notes/${noteId}/collaborators/${collabId}`, { method: 'DELETE' })
      if (res.ok) {
        setCollaborators((prev) => prev.filter((c) => c.id !== collabId))
        success('Collaborator removed')
      }
    } catch {
      toastError('Failed to remove collaborator')
    }
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    success('Invite link copied to clipboard')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Share note</h2>
          <p className="mt-0.5 text-xs text-neutral-500 truncate">{noteTitle}</p>
        </div>

        <div className="p-5 space-y-5">
          {/* Invite form */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-neutral-700">Invite by email</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                placeholder="colleague@example.com"
                className="flex-1 h-8 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'edit' | 'view')}
                className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                <option value="edit">Can edit</option>
                <option value="view">Can view</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !email.trim()}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                  email.trim() && !inviting
                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                    : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                )}
              >
                {inviting ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                Invite
              </button>
            </div>
          </div>

          {/* Generated invite link */}
          {inviteLink && (
            <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 space-y-1.5">
              <p className="text-[10px] font-medium text-violet-700">Invite link generated</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 truncate text-[10px] text-violet-600 font-mono">{inviteLink}</p>
                <button
                  onClick={() => copyLink(inviteLink)}
                  className="flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-800 transition-colors"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Collaborator list */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-neutral-700">
              {collaborators.length > 0 ? `${collaborators.length} collaborator${collaborators.length !== 1 ? 's' : ''}` : 'No collaborators yet'}
            </p>

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-neutral-400" />
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {collaborators.map((collab) => (
                  <div key={collab.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-medium text-neutral-600">
                      {(collab.display_name || collab.invited_email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      {collab.display_name && (
                        <p className="text-xs font-medium text-neutral-700 truncate">{collab.display_name}</p>
                      )}
                      <p className={cn('truncate text-neutral-500', collab.display_name ? 'text-[10px]' : 'text-xs')}>
                        {collab.invited_email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {collab.accepted_at ? (
                        <span className="text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Joined</span>
                      ) : (
                        <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Pending</span>
                      )}
                      <select
                        value={collab.permission}
                        onChange={(e) => handlePermissionChange(collab.id, e.target.value as 'edit' | 'view')}
                        className="text-[10px] border border-neutral-200 rounded px-1 py-0.5 text-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                      >
                        <option value="edit">Edit</option>
                        <option value="view">View</option>
                      </select>
                      <button
                        onClick={() => handleRemove(collab.id)}
                        className="hidden group-hover:flex text-neutral-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
            <Shield size={10} />
            Only invited people can access this note
          </div>
          <button
            onClick={onClose}
            className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
