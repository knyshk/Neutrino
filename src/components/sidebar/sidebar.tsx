'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Upload,
  Mic,
  MessageSquare,
  Plus,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
  Loader2,
  X,
  Sun,
  Moon,
} from 'lucide-react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useNotesStore } from '@/store/notes-store'
import { useUIStore } from '@/store/ui-store'
import { NoteList } from './note-list'
import { FileUpload, FileListItem } from '@/components/upload/file-upload'
import { Recorder, RecordingListItem } from '@/components/recording/recorder'
import { AIChat } from '@/components/ai/chat'
import { UploadedFile, Recording } from '@/types'
import { cn } from '@/lib/utils'

type Tab = 'notes' | 'files' | 'recordings' | 'ai'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'notes', label: 'Notes', icon: <FileText size={16} /> },
  { id: 'files', label: 'Files', icon: <Upload size={16} /> },
  { id: 'recordings', label: 'Recordings', icon: <Mic size={16} /> },
  { id: 'ai', label: 'Ask AI', icon: <MessageSquare size={16} /> },
]

interface SidebarProps {
  onNewNote: () => void
  onTranscriptReady: (recording: Recording, note: import('@/types').Note) => void
  userEmail?: string
}

export function Sidebar({ onNewNote, onTranscriptReady, userEmail }: SidebarProps) {
  const router = useRouter()
  const { sidebarOpen, toggleSidebar, activeTab, setActiveTab } = useUIStore()
  const { searchQuery, setSearchQuery } = useNotesStore()
  const { resolvedTheme, setTheme } = useTheme()

  const [files, setFiles] = useState<UploadedFile[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [recordingsLoading, setRecordingsLoading] = useState(false)
  const filesLoaded = useRef(false)
  const recordingsLoaded = useRef(false)

  useEffect(() => {
    if (activeTab === 'files' && !filesLoaded.current) loadFiles()
    if (activeTab === 'recordings' && !recordingsLoaded.current) loadRecordings()
  }, [activeTab])

  async function loadFiles() {
    setFilesLoading(true)
    try {
      const res = await fetch('/api/upload')
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files || [])
        filesLoaded.current = true
      }
    } catch { /* non-critical */ } finally {
      setFilesLoading(false)
    }
  }

  async function loadRecordings() {
    setRecordingsLoading(true)
    try {
      const res = await fetch('/api/transcribe')
      if (res.ok) {
        const data = await res.json()
        setRecordings(data.recordings || [])
        recordingsLoaded.current = true
      }
    } catch { /* non-critical */ } finally {
      setRecordingsLoading(false)
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!sidebarOpen) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 py-3">
        <button
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-600">
            <span className="text-xs font-bold text-white">N</span>
          </div>
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">Neutrino</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 hover:bg-white dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-2 pt-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-t-md px-1 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-violet-600 text-violet-700 bg-white dark:bg-neutral-800 dark:text-violet-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            )}
          >
            {tab.icon}
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'notes' && (
          <>
            <div className="p-2 space-y-1.5">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes…"
                  data-search-input
                  className={cn(
                    'h-8 w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 pl-8 text-xs text-neutral-700 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-400',
                    searchQuery ? 'pr-6' : 'pr-3'
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
              <button
                onClick={onNewNote}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 dark:hover:text-violet-400 transition-colors"
              >
                <Plus size={13} />
                New note
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NoteList />
            </div>
          </>
        )}

        {activeTab === 'files' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            <FileUpload
              onUploadComplete={(file) => {
                setFiles((prev) => [file, ...prev])
              }}
            />
            {filesLoading && (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-neutral-400" />
              </div>
            )}
            {!filesLoading && files.length === 0 && (
              <div className="px-3 py-4 text-center">
                <Upload size={20} className="mx-auto mb-2 text-neutral-300" />
                <p className="text-xs text-neutral-400">No files yet</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Drop a PDF, DOCX, or TXT above</p>
              </div>
            )}
            {files.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                  Uploaded files
                </p>
                {files.map((f) => (
                  <FileListItem
                    key={f.id}
                    file={f}
                    onDelete={(id) => setFiles((prev) => prev.filter((x) => x.id !== id))}
                    onReembedSuccess={(id) =>
                      setFiles((prev) => prev.map((x) => x.id === id ? { ...x, extraction_status: 'done' } : x))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recordings' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            <Recorder
              onTranscriptReady={(recording, note) => {
                setRecordings((prev) => [recording, ...prev])
                onTranscriptReady(recording, note)
              }}
            />
            {recordingsLoading && (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-neutral-400" />
              </div>
            )}
            {!recordingsLoading && recordings.length === 0 && (
              <div className="px-3 py-4 text-center">
                <Mic size={20} className="mx-auto mb-2 text-neutral-300" />
                <p className="text-xs text-neutral-400">No recordings yet</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Record a meeting or voice note above</p>
              </div>
            )}
            {recordings.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <p className="px-3 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                  Past recordings
                </p>
                {recordings.map((r) => (
                  <RecordingListItem
                    key={r.id}
                    recording={r}
                    onRetry={(updated, note) => {
                      setRecordings((prev) => prev.map((x) => x.id === updated.id ? updated : x))
                      if (note) onTranscriptReady(updated, note)
                    }}
                    onDelete={(id) => setRecordings((prev) => prev.filter((x) => x.id !== id))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <AIChat />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 p-2">
        <div className="flex items-center gap-1">
          <Link href="/settings" className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
            <Settings size={13} />
            Settings
          </Link>
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          <LogOut size={13} />
          <span className="truncate">{userEmail || 'Sign out'}</span>
        </button>
      </div>
    </div>
  )
}
