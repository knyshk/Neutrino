'use client'

import { FileText } from 'lucide-react'
import { TipTapEditor } from '@/components/editor/tiptap-editor'
import { Note } from '@/types'
import { formatDate } from '@/lib/utils'

interface PublicNoteViewerProps {
  note: { id: string; title: string; content: Record<string, unknown> | null; updated_at: string }
  ownerName: string | null
}

export function PublicNoteViewer({ note, ownerName }: PublicNoteViewerProps) {
  const fakeNote: Note = {
    id: note.id,
    user_id: '',
    title: note.title,
    content: note.content,
    content_text: null,
    source_type: 'manual',
    recording_id: null,
    file_id: null,
    is_deleted: false,
    created_at: note.updated_at,
    updated_at: note.updated_at,
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top bar */}
      <header className="border-b border-neutral-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className="text-sm font-semibold text-neutral-800">Neutrino</span>
        </div>
        <a
          href="/login"
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors"
        >
          Sign in to create notes
        </a>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Note header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900 leading-tight">
            {note.title || 'Untitled Note'}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
            <FileText size={12} />
            {ownerName && <span>by {ownerName}</span>}
            {ownerName && <span>·</span>}
            <span>Updated {formatDate(note.updated_at)}</span>
          </div>
        </div>

        {/* Read-only editor */}
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          {note.content ? (
            <TipTapEditor key={note.id} note={fakeNote} onSave={async () => {}} readOnly />
          ) : (
            <div className="px-8 py-12 text-center text-neutral-400 text-sm">
              This note has no content yet.
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-neutral-400">
          Shared via <a href="/" className="text-violet-500 hover:underline">Neutrino</a>
        </p>
      </div>
    </div>
  )
}
