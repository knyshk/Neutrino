'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    // PASSWORD_RECOVERY fires when Supabase processes the reset link token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true)
    })
    // Also check existing session (e.g. if user reloads the page)
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
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="text-green-500" size={40} />
              <p className="text-sm font-medium text-neutral-900">Password updated!</p>
              <p className="text-xs text-neutral-500">Redirecting you to your workspace…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* New password with eye toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    autoComplete="new-password"
                    className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 pr-10 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 hover:border-neutral-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs text-neutral-500">At least 8 characters</p>
              </div>

              {/* Confirm password with eye toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Confirm password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 pr-10 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 hover:border-neutral-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}

              {!sessionReady && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                  Verifying reset link…
                </div>
              )}

              <Button type="submit" loading={loading} disabled={!sessionReady} className="mt-1 w-full">
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
