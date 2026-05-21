'use client'

import { useState } from 'react'
import { FileText, Mic, Upload, RotateCcw, Trash2 } from 'lucide-react'
import { useNotesStore } from '@/store/notes-store'
import { Note } from '@/types'
import { formatDate, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function NoteList() {
  const { getFilteredNotes, getTrashedNotes, activeNoteId, setActiveNote, showTrash, setShowTrash, updateNote, removeNote } = useNotesStore()
  const notes = showTrash ? getTrashedNotes() : getFilteredNotes()

  async function handleRestore(note: Note) {
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_deleted: false }),
    })
    updateNote(note.id, { is_deleted: false })
  }

  async function handlePermanentDelete(note: Note) {
    if (!confirm(`Permanently delete "${note.title}"? This cannot be undone.`)) return
    await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
    removeNote(note.id)
  }

  const trashedCount = getTrashedNotes().length

  return (
    <div className="flex flex-col h-full">
      {/* Trash toggle */}
      {trashedCount > 0 && (
        <button
          onClick={() => setShowTrash(!showTrash)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium transition-colors border-b border-neutral-100',
            showTrash
              ? 'text-red-500 bg-red-50'
              : 'text-neutral-400 hover:text-neutral-600'
          )}
        >
          <Trash2 size={10} />
          {showTrash ? `← Back to notes` : `Trash (${trashedCount})`}
        </button>
      )}

      {notes.length === 0 && (
        <div className="px-3 py-6 text-center">
          <FileText size={24} className="mx-auto mb-2 text-neutral-300" />
          <p className="text-xs text-neutral-400">
            {showTrash ? 'Trash is empty' : 'No notes yet. Create one!'}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {notes.map((note) =>
          showTrash ? (
            <TrashedNoteItem
              key={note.id}
              note={note}
              onRestore={() => handleRestore(note)}
              onDelete={() => handlePermanentDelete(note)}
            />
          ) : (
            <NoteListItem
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              onClick={() => setActiveNote(note.id)}
            />
          )
        )}
      </div>
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
        <SourceIcon size={11} className={isActive ? 'text-violet-600' : 'text-neutral-400'} />
        <span className={cn('truncate text-xs font-medium', isActive ? 'text-violet-700' : 'text-neutral-700')}>
          {note.title || 'Untitled Note'}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-neutral-400">{preview}</span>
        <span className="shrink-0 text-[10px] text-neutral-300">{formatDate(note.updated_at)}</span>
      </div>
    </button>
  )
}

function TrashedNoteItem({
  note,
  onRestore,
  onDelete,
}: {
  note: Note
  onRestore: () => void
  onDelete: () => void
}) {
  const [restoring, setRestoring] = useState(false)

  return (
    <div className="group flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 transition-colors">
      <FileText size={11} className="text-neutral-300 shrink-0" />
      <span className="flex-1 truncate text-xs text-neutral-500">{note.title || 'Untitled Note'}</span>
      <div className="hidden group-hover:flex items-center gap-1">
        <button
          onClick={async () => { setRestoring(true); await onRestore(); setRestoring(false) }}
          disabled={restoring}
          className="text-[10px] text-neutral-400 hover:text-violet-600 transition-colors"
          title="Restore"
        >
          <RotateCcw size={11} />
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] text-neutral-400 hover:text-red-500 transition-colors"
          title="Delete permanently"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
