'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import * as Y from 'yjs'
import { Toolbar } from './toolbar'
import { PresenceAvatars } from './presence-avatars'
import { SupabaseProvider, CollabUser } from '@/lib/collaboration/supabase-provider'
import { tiptapToMarkdown } from '@/lib/collaboration/markdown'
import { Note } from '@/types'
import { cn } from '@/lib/utils'
import { Download } from 'lucide-react'

interface TipTapEditorProps {
  note: Note
  onSave: (content: Record<string, unknown>, contentText: string) => Promise<void>
  readOnly?: boolean
  currentUser?: CollabUser
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'

export function TipTapEditor({ note, onSave, readOnly = false, currentUser }: TipTapEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [remoteUsers, setRemoteUsers] = useState<CollabUser[]>([])
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef<string>(JSON.stringify(note.content))
  const ydocRef = useRef<Y.Doc>(new Y.Doc())
  const providerRef = useRef<SupabaseProvider | null>(null)
  const initializedRef = useRef(false)

  const handleAwarenessChange = useCallback(() => {
    if (providerRef.current) {
      setRemoteUsers(providerRef.current.getRemoteUsers())
    }
  }, [])

  // Create provider after first render so editor is available
  useEffect(() => {
    if (!currentUser || readOnly) return
    const ydoc = ydocRef.current
    const provider = new SupabaseProvider(ydoc, note.id, currentUser, handleAwarenessChange)
    providerRef.current = provider
    return () => {
      provider.destroy()
      providerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // runs once per mount (key={note.id} ensures remount on note change)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({}),
      Placeholder.configure({
        placeholder: 'Start writing…',
        emptyEditorClass: 'is-editor-empty',
      }),
      CharacterCount,
      Collaboration.configure({ document: ydocRef.current }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-violet-600 underline cursor-pointer' } }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-neutral max-w-none focus:outline-none min-h-[calc(100vh-200px)] px-8 py-6',
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getJSON()
      const contentStr = JSON.stringify(content)
      if (contentStr === lastSavedContent.current) return

      setSaveStatus('unsaved')
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          await onSave(content as Record<string, unknown>, editor.getText())
          lastSavedContent.current = contentStr
          setSaveStatus('saved')
        } catch {
          setSaveStatus('unsaved')
        }
      }, 2000)
    },
  })

  // Initialize content: wait briefly for remote peer state, then load from DB if alone
  useEffect(() => {
    if (!editor || initializedRef.current) return
    initializedRef.current = true

    const delay = currentUser ? 1200 : 0
    const timer = setTimeout(() => {
      const current = JSON.stringify(editor.getJSON())
      const empty = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
      if (current === empty && note.content) {
        editor.commands.setContent(note.content)
        lastSavedContent.current = JSON.stringify(note.content)
        setSaveStatus('saved')
      }
    }, delay)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

  function handleExportMarkdown() {
    if (!editor) return
    const md = tiptapToMarkdown(editor.getJSON() as Record<string, unknown>)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(note.title || 'note').replace(/[^a-z0-9]/gi, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const wordCount = editor?.storage.characterCount?.words() ?? 0
  const charCount = editor?.storage.characterCount?.characters() ?? 0
  const readMins = Math.max(1, Math.round(wordCount / 200))

  return (
    <div className="flex h-full flex-col">
      {!readOnly && (
        <div className="flex items-center justify-between border-b border-neutral-100 bg-white">
          <Toolbar editor={editor} />
          <div className="flex items-center gap-3 px-3 py-1.5 shrink-0">
            <PresenceAvatars users={remoteUsers} />
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-violet-600 transition-colors"
              title="Export as Markdown"
            >
              <Download size={11} />
              .md
            </button>
            <span
              className={cn('text-xs transition-colors whitespace-nowrap', {
                'text-neutral-400': saveStatus === 'saved',
                'text-amber-500': saveStatus === 'saving' || saveStatus === 'unsaved',
              })}
            >
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'unsaved' && 'Unsaved'}
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} className="h-full" />
      </div>
      {!readOnly && (
        <div className="border-t border-neutral-100 bg-white px-8 py-1.5 flex items-center gap-3">
          <span className="text-[10px] text-neutral-400">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          <span className="text-[10px] text-neutral-300">·</span>
          <span className="text-[10px] text-neutral-400">{charCount} chars</span>
          <span className="text-[10px] text-neutral-300">·</span>
          <span className="text-[10px] text-neutral-400">{readMins} min read</span>
        </div>
      )}
    </div>
  )
}
