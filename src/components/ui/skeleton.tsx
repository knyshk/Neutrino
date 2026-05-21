import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-neutral-100', className)} />
  )
}

export function NoteListSkeleton() {
  return (
    <div className="py-1 space-y-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-2.5 w-48" />
        </div>
      ))}
    </div>
  )
}

export function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-100 px-8 pt-6 pb-4">
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="flex-1 px-8 py-6 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <div className="pt-2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}
