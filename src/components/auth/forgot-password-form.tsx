'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
        return
      }

      // Always show success — never confirm if email exists (security best practice)
      setSuccess(true)
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
          <h1 className="text-2xl font-bold text-neutral-900">Forgot password</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          {success ? (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
              Check your email for a reset link
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}

              <Button type="submit" loading={loading} className="mt-1 w-full">
                Send reset link
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
