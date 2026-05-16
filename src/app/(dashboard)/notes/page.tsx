'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sidebar } from '@/components/sidebar/sidebar'
import { TipTapEditor } from '@/components/editor/tiptap-editor'
import { useNotesStore } from '@/store/notes-store'
import { Note, Recording } from '@/types'
import { FileText, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'

export default function NotesPage() {
  const { notes, setNotes, addNote, updateNote, activeNoteId, getActiveNote, setLoading, isLoading } =
    useNotesStore()
  const [userEmail, setUserEmail] = useState<string | undefined>()

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setUserEmail(user?.email)

        const res = await fetch('/api/notes')
        if (res.ok) {
          const { notes } = await res.json()
          setNotes(notes)
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [setNotes, setLoading])

  async function handleNewNote() {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled Note' }),
    })

    if (res.ok) {
      const { note } = await res.json()
      addNote(note)
      useNotesStore.getState().setActiveNote(note.id)
    }
  }

  async function handleSaveNote(content: Record<string, unknown>, contentText: string) {
    if (!activeNoteId) return

    const res = await fetch(`/api/notes/${activeNoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, content_text: contentText }),
    })

    if (res.ok) {
      const { note } = await res.json()
      updateNote(activeNoteId, {
        content: note.content,
        content_text: note.content_text,
        updated_at: note.updated_at,
      })
    }
  }

  async function handleUpdateTitle(noteId: string, title: string) {
    await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    updateNote(noteId, { title })
  }

  function handleTranscriptReady(_recording: Recording, note: Note) {
    addNote(note)
    useNotesStore.getState().setActiveNote(note.id)
  }

  const activeNote = getActiveNote()

  return (
    <div className="flex h-full">
      <Sidebar onNewNote={handleNewNote} onTranscriptReady={handleTranscriptReady} userEmail={userEmail} />

      <main className="flex flex-1 flex-col overflow-hidden bg-white">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : !activeNote ? (
          <EmptyState onNewNote={handleNewNote} hasNotes={notes.length > 0} />
        ) : (
          <NoteWorkspace
            note={activeNote}
            onSave={handleSaveNote}
            onUpdateTitle={handleUpdateTitle}
          />
        )}
      </main>
    </div>
  )
}

function NoteWorkspace({
  note,
  onSave,
  onUpdateTitle,
}: {
  note: Note
  onSave: (content: Record<string, unknown>, contentText: string) => Promise<void>
  onUpdateTitle: (noteId: string, title: string) => Promise<void>
}) {
  const [title, setTitle] = useState(note.title)
  const titleDebounce = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(note.title)
  }, [note.id, note.title])

  function handleTitleChange(value: string) {
    setTitle(value)
    if (titleDebounce[0]) clearTimeout(titleDebounce[0])
    const t = setTimeout(() => {
      onUpdateTitle(note.id, value || 'Untitled Note')
    }, 1000)
    titleDebounce[1](t)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-100 bg-white px-8 pt-6 pb-2">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled Note"
          className="w-full text-2xl font-bold text-neutral-900 placeholder-neutral-300 focus:outline-none bg-transparent"
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <TipTapEditor key={note.id} note={note} onSave={onSave} />
      </div>
    </div>
  )
}

function EmptyState({
  onNewNote,
  hasNotes,
}: {
  onNewNote: () => void
  hasNotes: boolean
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
        <FileText size={28} className="text-violet-500" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-neutral-800">
          {hasNotes ? 'Select a note' : 'Your workspace is empty'}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {hasNotes
            ? 'Choose a note from the sidebar or create a new one'
            : 'Create your first note to get started'}
        </p>
      </div>
      <button
        onClick={onNewNote}
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
      >
        <Sparkles size={15} />
        New note
      </button>
    </div>
  )
}
