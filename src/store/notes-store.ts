import { create } from 'zustand'
import { Note } from '@/types'

interface NotesState {
  notes: Note[]
  activeNoteId: string | null
  isLoading: boolean
  searchQuery: string
  showTrash: boolean
  setNotes: (notes: Note[]) => void
  addNote: (note: Note) => void
  updateNote: (id: string, updates: Partial<Note>) => void
  removeNote: (id: string) => void
  setActiveNote: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setSearchQuery: (query: string) => void
  setShowTrash: (show: boolean) => void
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

  getActiveNote: () => {
    const { notes, activeNoteId } = get()
    return notes.find((n) => n.id === activeNoteId)
  },

  getFilteredNotes: () => {
    const { notes, searchQuery } = get()
    if (!searchQuery.trim()) return notes.filter((n) => !n.is_deleted)

    const q = searchQuery.toLowerCase()
    return notes.filter(
      (n) =>
        !n.is_deleted &&
        (n.title.toLowerCase().includes(q) ||
          (n.content_text?.toLowerCase().includes(q) ?? false))
    )
  },

  getTrashedNotes: () => get().notes.filter((n) => n.is_deleted),
}))
