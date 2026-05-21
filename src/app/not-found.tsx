import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
        <FileQuestion size={28} className="text-violet-500" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Page not found</h1>
        <p className="mt-2 text-sm text-neutral-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/notes"
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
      >
        Go to workspace
      </Link>
    </div>
  )
}
