'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

// Requires 'avatars' storage bucket in Supabase with public access enabled

export default function SettingsPage() {
  const router = useRouter()
  const { success: toastSuccess, error: toastError } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      setUserId(user.id)
      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single()

      if (profile) {
        setDisplayName(profile.display_name ?? '')
        setAvatarUrl(profile.avatar_url ?? null)
      }

      setLoading(false)
    }

    init()
  }, [])

  async function handleSave() {
    setError(null)
    setSaving(true)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('user_profiles')
        .update({ display_name: displayName, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) {
        setError(error.message)
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toastError('Avatar must be under 2 MB.')
      return
    }

    setAvatarUploading(true)
    try {
      const supabase = createClient()
      const path = `${userId}/avatar.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) {
        toastError(uploadError.message)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)

      if (updateError) {
        toastError(updateError.message)
        return
      }

      setAvatarUrl(publicUrl)
      toastSuccess('Avatar updated')
    } finally {
      setAvatarUploading(false)
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toastError(data.error ?? 'Unknown error')
        return
      }
      router.push('/login')
    } finally {
      setDeleting(false)
    }
  }

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-violet-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <Link
        href="/notes"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to notes
      </Link>

      <h1 className="mb-6 text-xl font-semibold text-neutral-900">Settings</h1>

      <div className="flex flex-col gap-6">
        {/* Profile section */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">Profile</h2>
          <div className="flex flex-col gap-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative h-16 w-16 flex-shrink-0 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
                title="Click to upload avatar"
                disabled={avatarUploading}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-violet-100 text-violet-700 text-lg font-semibold">
                    {initials}
                  </div>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                    <Loader2 size={20} className="animate-spin text-white" />
                  </div>
                )}
              </button>
              <div>
                <p className="text-sm font-medium text-neutral-700">Profile photo</p>
                <p className="text-xs text-neutral-500 mt-0.5">Click to upload. Max 2 MB.</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <Input
              label="Display name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} loading={saving} size="sm">
                {saved ? 'Saved!' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>

        {/* Account section */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900">Account</h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Email</label>
              <p className="text-sm text-neutral-500">{email}</p>
            </div>

            <div className="border-t border-neutral-100 pt-4">
              <p className="mb-2 text-sm font-medium text-neutral-700">Password</p>
              <Link
                href="/forgot-password"
                className="text-sm text-violet-600 hover:text-violet-700 transition-colors"
              >
                Send a password reset email &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-red-600">Danger zone</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-900">Delete account</p>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Permanently removes all your notes, files, and recordings
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-neutral-600">
                Type <span className="font-mono font-semibold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="h-9 rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"
              />
              <Button
                variant="danger"
                size="sm"
                disabled={deleteConfirm !== 'DELETE' || deleting}
                loading={deleting}
                onClick={handleDeleteAccount}
              >
                Delete account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
