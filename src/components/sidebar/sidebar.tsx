'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useNotesStore } from '@/store/notes-store'
import { useUIStore } from '@/store/ui-store'
import { NoteList } from './note-list'
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
  userEmail?: string
}

export function Sidebar({ onNewNote, userEmail }: SidebarProps) {
  const router = useRouter()
  const { sidebarOpen, toggleSidebar, activeTab, setActiveTab } = useUIStore()
  const { searchQuery, setSearchQuery } = useNotesStore()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!sidebarOpen) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-r border-neutral-100 bg-neutral-50 py-3">
        <button
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-neutral-100 bg-neutral-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-600">
            <span className="text-xs font-bold text-white">N</span>
          </div>
          <span className="text-sm font-semibold text-neutral-900">Neutrino</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-100 px-2 pt-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-t-md px-1 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-violet-600 text-violet-700 bg-white'
                : 'text-neutral-500 hover:text-neutral-700'
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
            {/* Search + New Note */}
            <div className="p-2 space-y-1.5">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes…"
                  className="h-8 w-full rounded-md border border-neutral-200 bg-white pl-8 pr-3 text-xs text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              </div>
              <button
                onClick={onNewNote}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
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
          <div className="p-3 text-xs text-neutral-500 text-center mt-8">
            <Upload size={24} className="mx-auto mb-2 text-neutral-300" />
            <p>File uploads coming soon</p>
          </div>
        )}

        {activeTab === 'recordings' && (
          <div className="p-3 text-xs text-neutral-500 text-center mt-8">
            <Mic size={24} className="mx-auto mb-2 text-neutral-300" />
            <p>Recordings coming soon</p>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="p-3 text-xs text-neutral-500 text-center mt-8">
            <MessageSquare size={24} className="mx-auto mb-2 text-neutral-300" />
            <p>AI assistant coming soon</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-100 p-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 transition-colors"
        >
          <LogOut size={13} />
          <span className="truncate">{userEmail || 'Sign out'}</span>
        </button>
      </div>
    </div>
  )
}
