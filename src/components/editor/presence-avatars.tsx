'use client'

import { CollabUser } from '@/lib/collaboration/supabase-provider'

interface PresenceAvatarsProps {
  users: CollabUser[]
}

export function PresenceAvatars({ users }: PresenceAvatarsProps) {
  if (users.length === 0) return null

  const visible = users.slice(0, 4)
  const overflow = users.length - 4

  return (
    <div className="flex items-center gap-1.5" title={users.map((u) => u.name).join(', ')}>
      <span className="text-[10px] text-neutral-400 hidden sm:inline">Live:</span>
      <div className="flex -space-x-1.5">
        {visible.map((user, i) => (
          <div
            key={i}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-sm"
            style={{ backgroundColor: user.color, zIndex: visible.length - i }}
            title={user.name}
          >
            {user.name[0]?.toUpperCase() ?? '?'}
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-neutral-300 text-[9px] font-medium text-neutral-600 shadow-sm">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  )
}
