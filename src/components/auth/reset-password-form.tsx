'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase automatically processes the access_token from the URL hash.
    // We listen for the PASSWORD_RECOVERY event to know the token is valid.
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if the session is already established (e.g. on reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/notes'), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
              <span className="text-lg font-bold text-white">N</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Set new password</h1>
          <p className="mt-1 text-sm text-neutral-500">Choose a strong password for your account</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          {success ? (
            <div className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
              Password updated! Redirecting&hellip;
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                label="New password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                autoComplete="new-password"
                helperText="At least 8 characters"
              />
              <Input
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}

              {!sessionReady && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                  Waiting for reset link to be verified&hellip;
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                disabled={!sessionReady}
                className="mt-1 w-full"
              >
                Update password
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-neutral-500">
            <Link href="/login" className="font-medium text-violet-600 hover:text-violet-700">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
