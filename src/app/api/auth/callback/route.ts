import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')           // OAuth + PKCE email confirmation
  const tokenHash = searchParams.get('token_hash') // Legacy email link confirmation
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/notes'

  const supabase = await createClient()

  // PKCE flow — OAuth login OR email confirmation via code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
  }

  // Token hash flow — email confirmation link / password reset link
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      // Password recovery: go to reset-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
  }

  return NextResponse.redirect(`${origin}/login?error=missing_token`)
}
