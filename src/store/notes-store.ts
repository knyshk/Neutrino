import { create } from 'zustand'
import { Note } from '@/types'

interface NotesState {
  notes: Note[]
  activeNoteId: string | null
  isLoading: boolean
  searchQuery: string
  showTrash: boolean
  sortOrder: 'updated' | 'created' | 'alpha'
  setNotes: (notes: Note[]) => void
  addNote: (note: Note) => void
  updateNote: (id: string, updates: Partial<Note>) => void
  removeNote: (id: string) => void
  setActiveNote: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  setShowTrash: (show: boolean) => void
  setSortOrder: (order: 'updated' | 'created' | 'alpha') => void
  getActiveNote: () => Note | undefined
  getFilteredNotes: () => Note[]
  getTrashedNotes: () => Note[]
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  isLoading: false,
  searchQuery: '',
  showTrash: false,
  sortOrder: 'updated',

  setNotes: (notes) => set({ notes }),

  addNote: (note) =>
    set((state) => ({ notes: [note, ...state.notes] })),

  updateNote: (id, updates) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  removeNote: (id) =>
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
    })),

  setActiveNote: (id) => set({ activeNoteId: id }),

  setLoading: (loading) => set({ isLoading: loading }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setShowTrash: (show) => set({ showTrash: show }),

  setSortOrder: (order) => set({ sortOrder: order }),

  getActiveNote: () => {
    const { notes, activeNoteId } = get()
    return notes.find((n) => n.id === activeNoteId)
  },

  getFilteredNotes: () => {
    const { notes, searchQuery, sortOrder } = get()
    const active = notes.filter((n) => !n.is_deleted)
    const filtered = !searchQuery.trim() ? active : active.filter(
      (n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.content_text?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    )
    const sorted = [...filtered].sort((a, b) => {
      if (sortOrder === 'alpha') {
        return (a.title || '').localeCompare(b.title || '')
      } else if (sortOrder === 'created') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      } else {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })
    return [...sorted.filter((n) => n.is_pinned), ...sorted.filter((n) => !n.is_pinned)]
  },

  getTrashedNotes: () => get().notes.filter((n) => n.is_deleted),
}))
