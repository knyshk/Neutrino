import { Suspense } from 'react'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata = { title: 'Create account — Neutrino' }

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
