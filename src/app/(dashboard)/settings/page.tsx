'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-neutral-900">Delete account</p>
              <p className="mt-0.5 text-sm text-neutral-500">
                Permanently removes all your notes, files, and recordings
              </p>
            </div>
            <div title="Contact support to delete your account">
              <Button variant="danger" size="sm" disabled>
                Delete account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
