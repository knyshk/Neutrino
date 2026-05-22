'use client'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
            <AlertTriangle className="text-red-600" size={24} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-neutral-500 mb-6">An unexpected error occurred. Your data is safe.</p>
        <Button onClick={unstable_retry}>Try again</Button>
      </div>
    </div>
  )
}
