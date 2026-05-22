import React from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800',
        className
      )}
      style={style}
    />
  )
}

export function NoteListSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-3 flex-1 rounded" style={{ width: `${60 + (i % 3) * 15}%` }} />
          </div>
          <Skeleton className="h-2.5 w-3/4 rounded" />
          <Skeleton className="h-2 w-1/4 rounded" />
        </div>
      ))}
    </div>
  )
}

export function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-8 py-6">
      <Skeleton className="h-8 w-2/3 rounded-lg" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-5/6 rounded" />
      <Skeleton className="h-4 w-4/5 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-3/4 rounded" />
    </div>
  )
}
