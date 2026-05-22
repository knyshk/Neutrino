'use client'

import { useEffect, useRef } from 'react'
import { X, Keyboard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShortcutsModalProps {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  { keys: ['⌘', 'N'], description: 'New note' },
  { keys: ['⌘', 'K'], description: 'Focus search' },
  { keys: ['⌘', 'B'], description: 'Bold' },
  { keys: ['⌘', 'I'], description: 'Italic' },
  { keys: ['⌘', '⇧', 'X'], description: 'Strike' },
  { keys: ['⌘', '⇧', 'H'], description: 'Highlight' },
  { keys: ['⌘', '↵'], description: 'Save (autosaves)' },
  { keys: ['?', '⌘', '/'], description: 'Open shortcuts' },
]

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-white border border-neutral-200 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-neutral-400" />
            <h2 className="text-sm font-semibold text-neutral-900">Keyboard shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-4">
          <table className="w-full">
            <tbody className="divide-y divide-neutral-50">
              {shortcuts.map((shortcut, index) => (
                <tr key={index} className="group">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && shortcut.description === 'Open shortcuts' && (
                            <span className="text-[10px] text-neutral-400">or</span>
                          )}
                          <kbd
                            className={cn(
                              'inline-flex items-center justify-center rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-neutral-600',
                              key.length > 1 && 'px-2'
                            )}
                          >
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 text-sm text-neutral-600">{shortcut.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
