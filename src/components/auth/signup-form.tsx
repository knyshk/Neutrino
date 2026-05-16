'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split('@')[0] },
          emailRedirectTo: `${location.origin}/api/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    })
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <span className="text-2xl">✓</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Check your email</h1>
          <p className="mt-2 text-sm text-neutral-500">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm text-violet-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-neutral-900">Create your workspace</h1>
          <p className="mt-1 text-sm text-neutral-500">Start capturing and querying your knowledge</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            {googleLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-neutral-400">or</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              label="Display name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
              helperText="At least 8 characters"
            />

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <Button type="submit" loading={loading} className="mt-1 w-full">
              Create account
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-neutral-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-violet-600 hover:text-violet-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
