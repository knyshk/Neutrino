'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sidebar } from '@/components/sidebar/sidebar'
import { TipTapEditor } from '@/components/editor/tiptap-editor'
import { ShareModal } from '@/components/collaboration/share-modal'
import { useNotesStore } from '@/store/notes-store'
import { Note, Recording } from '@/types'
import { FileText, Sparkles, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'
import { CollabUser, getUserColor } from '@/lib/collaboration/supabase-provider'

export default function NotesPage() {
  return (
    <Suspense>
      <NotesPageInner />
    </Suspense>
  )
}

function NotesPageInner() {
  const { notes, setNotes, addNote, updateNote, activeNoteId, getActiveNote, setLoading, isLoading, setActiveNote } =
    useNotesStore()
  const [currentUser, setCurrentUser] = useState<CollabUser | undefined>()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('display_name')
            .eq('id', user.id)
            .single()

          setCurrentUser({
            name: profile?.display_name || user.email?.split('@')[0] || 'Anonymous',
            email: user.email || '',
            color: getUserColor(user.id),
          })
        }

        const [activeRes, trashedRes] = await Promise.all([
          fetch('/api/notes'),
          fetch('/api/notes?include_deleted=true'),
        ])
        const allNotes: Note[] = []
        if (activeRes.ok) {
          const { notes } = await activeRes.json()
          allNotes.push(...notes)
        }
        if (trashedRes.ok) {
          const { notes: trashed } = await trashedRes.json()
          allNotes.push(...trashed.filter((n: Note) => n.is_deleted))
        }
        setNotes(allNotes)

        const noteParam = searchParams.get('note')
        if (noteParam) setActiveNote(noteParam)
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNotes, setLoading])

  const handleNewNote = useCallback(async () => {
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
  }, [addNote])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'n') { e.preventDefault(); handleNewNote() }
      if (meta && e.key === 'k') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('[data-search-input]')?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleNewNote])

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
      <Sidebar onNewNote={handleNewNote} onTranscriptReady={handleTranscriptReady} userEmail={currentUser?.email} />
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
            currentUser={currentUser}
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
  currentUser,
  onSave,
  onUpdateTitle,
}: {
  note: Note
  currentUser?: CollabUser
  onSave: (content: Record<string, unknown>, contentText: string) => Promise<void>
  onUpdateTitle: (noteId: string, title: string) => Promise<void>
}) {
  const [title, setTitle] = useState(note.title)
  const [shareOpen, setShareOpen] = useState(false)
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(note.title)
  }, [note.id, note.title])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current)
    }
  }, [])

  function handleTitleChange(value: string) {
    setTitle(value)
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current)
    titleDebounceRef.current = setTimeout(() => {
      onUpdateTitle(note.id, value || 'Untitled Note')
    }, 1000)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-neutral-100 bg-white px-8 pt-6 pb-2 gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled Note"
          className="flex-1 text-2xl font-bold text-neutral-900 placeholder-neutral-300 focus:outline-none bg-transparent"
        />
        <button
          onClick={() => setShareOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-violet-300 hover:text-violet-600 transition-colors"
        >
          <Share2 size={13} />
          Share
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <TipTapEditor key={note.id} note={note} onSave={onSave} currentUser={currentUser} />
      </div>
      {shareOpen && (
        <ShareModal noteId={note.id} noteTitle={title || note.title} onClose={() => setShareOpen(false)} />
      )}
    </div>
  )
}

function EmptyState({ onNewNote, hasNotes }: { onNewNote: () => void; hasNotes: boolean }) {
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
          {hasNotes ? 'Choose a note from the sidebar or create a new one' : 'Create your first note to get started'}
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          <kbd className="rounded border border-neutral-200 px-1 py-0.5 text-[10px] font-mono">⌘N</kbd> new note
          &nbsp;·&nbsp;
          <kbd className="rounded border border-neutral-200 px-1 py-0.5 text-[10px] font-mono">⌘K</kbd> search
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
