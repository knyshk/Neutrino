'use client'

import { FileText, Mic, Upload } from 'lucide-react'
import { useNotesStore } from '@/store/notes-store'
import { Note } from '@/types'
import { formatDate, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function NoteList() {
  const { getFilteredNotes, activeNoteId, setActiveNote } = useNotesStore()
  const notes = getFilteredNotes()

  if (notes.length === 0) {
    return (
      <div className="px-3 py-6 text-center">
        <FileText size={24} className="mx-auto mb-2 text-neutral-300" />
        <p className="text-xs text-neutral-400">No notes yet. Create one!</p>
      </div>
    )
  }

  return (
    <div className="py-1">
      {notes.map((note) => (
        <NoteListItem
          key={note.id}
          note={note}
          isActive={note.id === activeNoteId}
          onClick={() => setActiveNote(note.id)}
        />
      ))}
    </div>
  )
}

function NoteListItem({
  note,
  isActive,
  onClick,
}: {
  note: Note
  isActive: boolean
  onClick: () => void
}) {
  const SourceIcon = {
    manual: FileText,
    recording: Mic,
    upload: Upload,
  }[note.source_type] || FileText

  const preview = note.content_text
    ? truncate(note.content_text.replace(/\n+/g, ' '), 60)
    : 'Empty note'

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors',
        isActive
          ? 'bg-violet-50 border-r-2 border-violet-600'
          : 'hover:bg-neutral-100'
      )}
    >
      <div className="flex items-center gap-1.5">
        <SourceIcon
          size={11}
          className={isActive ? 'text-violet-600' : 'text-neutral-400'}
        />
        <span
          className={cn(
            'truncate text-xs font-medium',
            isActive ? 'text-violet-700' : 'text-neutral-700'
          )}
        >
          {note.title || 'Untitled Note'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-neutral-400">{preview}</span>
        <span className="shrink-0 text-[10px] text-neutral-300">
          {formatDate(note.updated_at)}
        </span>
      </div>
    </button>
  )
}
