import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata = { title: 'Set new password — Neutrino' }

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
