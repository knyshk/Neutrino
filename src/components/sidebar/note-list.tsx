'use client'

import { useState, useEffect, useRef } from 'react'
import {
  FileText, Mic, Upload, RotateCcw, Trash2, Users, Pin, ArrowUpDown,
  ChevronRight, ChevronDown, MoreHorizontal,
} from 'lucide-react'
import { useNotesStore } from '@/store/notes-store'
import { Note } from '@/types'
import { formatDate, truncate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { NoteListSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'

const SORT_LABELS: Record<'updated' | 'created' | 'alpha', string> = {
  updated: 'Updated',
  created: 'Created',
  alpha: 'A→Z',
}

const SORT_CYCLE: Array<'updated' | 'created' | 'alpha'> = ['updated', 'created', 'alpha']

export function NoteList() {
  const {
    getFilteredNotes, getTrashedNotes, activeNoteId, setActiveNote,
    showTrash, setShowTrash, updateNote, removeNote, addNote,
    isLoading, sortOrder, setSortOrder,
    expandedNotes, toggleExpanded,
  } = useNotesStore()
  const notes = showTrash ? getTrashedNotes() : getFilteredNotes()

  function cycleSortOrder() {
    const currentIdx = SORT_CYCLE.indexOf(sortOrder)
    const nextIdx = (currentIdx + 1) % SORT_CYCLE.length
    setSortOrder(SORT_CYCLE[nextIdx])
  }
  const { success: toastSuccess, error: toastError } = useToast()

  async function handlePin(note: Note) {
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    })
    updateNote(note.id, { is_pinned: !note.is_pinned })
  }

  async function handleRestore(note: Note) {
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_deleted: false }),
    })
    updateNote(note.id, { is_deleted: false })
    toastSuccess(`"${note.title || 'Untitled'}" restored`)
  }

  async function handlePermanentDelete(note: Note, confirmed: boolean, setConfirmed: (v: boolean) => void) {
    if (!confirmed) { setConfirmed(true); return }
    setConfirmed(false)
    const res = await fetch(`/api/notes/${note.id}?permanent=true`, { method: 'DELETE' })
    if (res.ok) {
      removeNote(note.id)
      toastSuccess(`"${note.title || 'Untitled'}" permanently deleted`)
    } else {
      toastError('Failed to delete note')
    }
  }

  async function handleNewSubpage(parentId: string) {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', parent_id: parentId }),
    })
    if (res.ok) {
      const { note } = await res.json()
      addNote(note)
      if (!expandedNotes.has(parentId)) toggleExpanded(parentId)
      setActiveNote(note.id)
    } else {
      toastError('Failed to create subpage')
    }
  }

  async function handleDuplicate(note: Note) {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${note.title || 'Untitled'} (copy)`,
        content: note.content,
        content_text: note.content_text,
        source_type: note.source_type,
        parent_id: note.parent_id ?? null,
      }),
    })
    if (res.ok) {
      const { note: newNote } = await res.json()
      addNote(newNote)
      setActiveNote(newNote.id)
      toastSuccess('Note duplicated')
    } else {
      toastError('Failed to duplicate note')
    }
  }

  async function handleTrash(note: Note) {
    const res = await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_deleted: true }),
    })
    if (res.ok) {
      updateNote(note.id, { is_deleted: true })
      toastSuccess(`"${note.title || 'Untitled'}" moved to trash`)
    } else {
      toastError('Failed to move to trash')
    }
  }

  async function handleRename(note: Note, newTitle: string) {
    const trimmed = newTitle.trim() || 'Untitled'
    const res = await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    if (res.ok) {
      updateNote(note.id, { title: trimmed })
    } else {
      toastError('Failed to rename note')
    }
  }

  const trashedCount = getTrashedNotes().length

  if (isLoading) {
    return <NoteListSkeleton />
  }

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

      {!showTrash && (
        <div className="flex items-center justify-end px-3 py-1 border-b border-neutral-100">
          <button
            onClick={cycleSortOrder}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors"
            title="Change sort order"
          >
            <ArrowUpDown size={10} />
            {SORT_LABELS[sortOrder]}
          </button>
        </div>
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
              onDelete={handlePermanentDelete}
            />
          ) : (
            <NoteListItem
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              onClick={() => setActiveNote(note.id)}
              onPin={() => handlePin(note)}
              onNewSubpage={handleNewSubpage}
              onDuplicate={handleDuplicate}
              onTrash={handleTrash}
              onRename={handleRename}
              depth={0}
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
  onPin,
  onNewSubpage,
  onDuplicate,
  onTrash,
  onRename,
  depth = 0,
}: {
  note: Note
  isActive: boolean
  onClick: () => void
  onPin?: () => void
  onNewSubpage?: (parentId: string) => void
  onDuplicate?: (note: Note) => void
  onTrash?: (note: Note) => void
  onRename?: (note: Note, newTitle: string) => void
  depth?: number
}) {
  const { expandedNotes, toggleExpanded, getChildNotes, activeNoteId, setActiveNote } = useNotesStore()
  const children = getChildNotes(note.id)
  const hasChildren = children.length > 0
  const isExpanded = expandedNotes.has(note.id)

  const [showMenu, setShowMenu] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(note.title || '')
  const menuRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [showMenu])

  // Focus rename input when renaming starts
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(note.title || '')
      setTimeout(() => renameInputRef.current?.select(), 0)
    }
  }, [isRenaming, note.title])

  const SourceIcon = {
    manual: FileText,
    recording: Mic,
    upload: Upload,
  }[note.source_type] || FileText

  const MAX_DEPTH = 4
  const indentPx = Math.min(depth, MAX_DEPTH) * 12

  function handleChevronClick(e: React.MouseEvent) {
    e.stopPropagation()
    toggleExpanded(note.id)
  }

  function handleMoreClick(e: React.MouseEvent) {
    e.stopPropagation()
    setShowMenu((v) => !v)
  }

  function handleMenuAction(action: () => void) {
    setShowMenu(false)
    action()
  }

  function handleRenameSubmit() {
    setIsRenaming(false)
    if (onRename) onRename(note, renameValue)
  }

  return (
    <div>
      <div
        className={cn(
          'group relative flex w-full flex-col gap-0.5 py-2 text-left transition-colors cursor-pointer',
          isActive
            ? 'bg-violet-100 dark:bg-violet-900/30 border-r-2 border-violet-500'
            : 'hover:bg-neutral-100 dark:hover:bg-white/5'
        )}
        style={{ paddingLeft: `${12 + indentPx}px`, paddingRight: '12px' }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
      >
        <div className="flex items-center gap-1">
          {/* Chevron for expand/collapse (only if has children) */}
          <span
            className="shrink-0 flex items-center justify-center w-4 h-4"
            onClick={hasChildren ? handleChevronClick : undefined}
            style={{ cursor: hasChildren ? 'pointer' : 'default' }}
          >
            {hasChildren ? (
              isExpanded
                ? <ChevronDown size={11} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300" />
                : <ChevronRight size={11} className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300" />
            ) : null}
          </span>

          {note.color && (
            <span
              className="shrink-0 rounded-full"
              style={{ width: 6, height: 6, backgroundColor: note.color }}
            />
          )}
          <SourceIcon size={11} className={isActive ? 'text-violet-600' : 'text-neutral-400'} />

          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleRenameSubmit() }
                if (e.key === 'Escape') { setIsRenaming(false) }
              }}
              onBlur={handleRenameSubmit}
              className="flex-1 min-w-0 text-xs font-medium bg-white dark:bg-[#252525] border border-violet-400 rounded px-1 py-0 text-neutral-700 dark:text-[#e8e8e8] focus:outline-none"
            />
          ) : (
            <span className={cn('flex-1 truncate text-xs font-medium', isActive ? 'text-violet-700 dark:text-violet-400' : 'text-neutral-700 dark:text-[#e8e8e8]')}>
              {note.title || 'Untitled Note'}
            </span>
          )}

          {note.is_shared && (
            <span title="Shared note">
              <Users size={9} className="shrink-0 text-violet-400" />
            </span>
          )}

          {/* Pin button */}
          <button
            onClick={(e) => { e.stopPropagation(); onPin?.() }}
            className="hidden group-hover:flex text-neutral-300 hover:text-amber-400 transition-colors shrink-0"
            title={note.is_pinned ? 'Unpin' : 'Pin note'}
          >
            {note.is_pinned ? <Pin size={9} className="text-amber-400" /> : <Pin size={9} />}
          </button>

          {/* Three-dots menu button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleMoreClick}
              className="hidden group-hover:flex items-center justify-center text-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors shrink-0 rounded"
              title="More options"
            >
              <MoreHorizontal size={13} />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-full mt-0.5 z-50 min-w-[160px] rounded-md border border-[#2d2d2d] bg-[#191919] shadow-lg py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#e8e8e8] hover:bg-[#252525] transition-colors"
                  onClick={() => handleMenuAction(() => onNewSubpage?.(note.id))}
                >
                  <FileText size={11} />
                  Add subpage
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#e8e8e8] hover:bg-[#252525] transition-colors"
                  onClick={() => handleMenuAction(() => onDuplicate?.(note))}
                >
                  <Upload size={11} />
                  Duplicate
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#e8e8e8] hover:bg-[#252525] transition-colors"
                  onClick={() => handleMenuAction(async () => {
                    const link = window.location.origin + '?note=' + note.id
                    try {
                      await navigator.clipboard.writeText(link)
                    } catch {
                      // Fallback for older browsers
                      const ta = document.createElement('textarea')
                      ta.value = link
                      document.body.appendChild(ta)
                      ta.select()
                      document.execCommand('copy')
                      document.body.removeChild(ta)
                    }
                  })}
                >
                  <Pin size={11} />
                  Copy link
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#e8e8e8] hover:bg-[#252525] transition-colors"
                  onClick={() => handleMenuAction(() => setIsRenaming(true))}
                >
                  <FileText size={11} />
                  Rename
                </button>
                <div className="my-1 border-t border-[#2d2d2d]" />
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-[#252525] transition-colors"
                  onClick={() => handleMenuAction(() => onTrash?.(note))}
                >
                  <Trash2 size={11} />
                  Move to trash
                </button>
              </div>
            )}
          </div>
        </div>

        {!isRenaming && (
          <>
            <div className="flex items-center justify-between gap-2 pl-5">
              <span className="truncate text-[11px] text-neutral-400">
                {note.content_text
                  ? truncate(note.content_text.replace(/\n+/g, ' '), 60)
                  : 'Empty note'}
              </span>
              <span className="shrink-0 text-[10px] text-neutral-300">{formatDate(note.updated_at)}</span>
            </div>
            <span className="text-[10px] text-neutral-400 pl-5">
              {Math.max(1, Math.round((note.content_text || '').split(/\s+/).filter(Boolean).length / 200))} min read
            </span>
          </>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => (
            <NoteListItem
              key={child.id}
              note={child}
              isActive={child.id === activeNoteId}
              onClick={() => setActiveNote(child.id)}
              onNewSubpage={onNewSubpage}
              onDuplicate={onDuplicate}
              onTrash={onTrash}
              onRename={onRename}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TrashedNoteItem({
  note,
  onRestore,
  onDelete,
}: {
  note: Note
  onRestore: () => void
  onDelete: (note: Note, confirmed: boolean, setConfirmed: (v: boolean) => void) => void
}) {
  const [restoring, setRestoring] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
          onClick={() => onDelete(note, confirmDelete, setConfirmDelete)}
          onBlur={() => setConfirmDelete(false)}
          className={cn(
            'text-[10px] transition-colors',
            confirmDelete ? 'text-red-500' : 'text-neutral-400 hover:text-red-500'
          )}
          title={confirmDelete ? 'Click again to confirm' : 'Delete permanently'}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
