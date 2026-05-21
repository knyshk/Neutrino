import { Suspense } from 'react'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata = { title: 'Reset password — Neutrino' }

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
