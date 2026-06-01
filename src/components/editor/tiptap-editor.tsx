'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Toolbar } from './toolbar'
import { tiptapToMarkdown } from '@/lib/collaboration/markdown'
import { Note } from '@/types'
import { cn } from '@/lib/utils'
import { Download, Printer, Copy } from 'lucide-react'

// CollabUser kept for prop compatibility — collaboration re-added when multi-user is stable
export type { CollabUser } from '@/lib/collaboration/supabase-provider'

interface TipTapEditorProps {
  note: Note
  onSave: (content: Record<string, unknown>, contentText: string) => Promise<void>
  readOnly?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentUser?: any
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'

const SAVE_DEBOUNCE_MS = 1500

export function TipTapEditor({ note, onSave, readOnly = false }: TipTapEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [copied, setCopied] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef<string>(JSON.stringify(note.content))
  const pendingSaveRef = useRef<{ content: Record<string, unknown>; text: string } | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({}),
      Placeholder.configure({
        placeholder: 'Start writing…',
        emptyEditorClass: 'is-editor-empty',
      }),
      CharacterCount,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-violet-600 underline cursor-pointer' } }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg my-4' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)] px-8 py-6',
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getJSON()
      const contentStr = JSON.stringify(content)
      if (contentStr === lastSavedContent.current) return

      const text = editor.getText()
      pendingSaveRef.current = { content: content as Record<string, unknown>, text }

      setSaveStatus('unsaved')
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          await onSave(content as Record<string, unknown>, text)
          lastSavedContent.current = contentStr
          pendingSaveRef.current = null
          setSaveStatus('saved')
        } catch {
          setSaveStatus('unsaved')
        }
      }, SAVE_DEBOUNCE_MS)
    },
  })

  // Load content from DB immediately on mount
  useEffect(() => {
    if (!editor) return
    if (note.content) {
      // Set lastSavedContent BEFORE setContent to avoid triggering a spurious save
      lastSavedContent.current = JSON.stringify(note.content)
      editor.commands.setContent(note.content)
      setSaveStatus('saved')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Flush pending saves before page unload — prevents losing the last ~1.5s of typing
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!pendingSaveRef.current) return
      // Cancel debounce and fire immediately (best-effort sync save)
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      const { content, text } = pendingSaveRef.current
      // navigator.sendBeacon doesn't support PATCH; use fetch with keepalive
      fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, content_text: text }),
        keepalive: true,
      })
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [note.id])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

  function handleCopy() {
    if (!editor) return
    navigator.clipboard.writeText(editor.getText())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

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
    <div className="flex h-full flex-col dark:bg-[#191919]">
      {!readOnly && (
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-[#2d2d2d] bg-white dark:bg-[#1f1f1f]">
          <Toolbar editor={editor} />
          <div className="flex items-center gap-3 px-3 py-1.5 shrink-0">
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              title="Export as Markdown"
            >
              <Download size={11} />
              .md
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              title="Print note"
            >
              <Printer size={11} />
            </button>
            <div className="relative">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                title="Copy note text"
              >
                <Copy size={11} />
              </button>
              {copied && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-white pointer-events-none">
                  Copied!
                </span>
              )}
            </div>
            <span
              className={cn('text-xs transition-colors whitespace-nowrap', {
                'text-neutral-400 dark:text-neutral-500': saveStatus === 'saved',
                'text-amber-500 dark:text-amber-400': saveStatus === 'saving' || saveStatus === 'unsaved',
              })}
            >
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'unsaved' && 'Unsaved'}
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#191919]">
        <EditorContent editor={editor} className="h-full" />
      </div>
      {!readOnly && (
        <div className="border-t border-neutral-100 dark:border-[#2d2d2d] bg-white dark:bg-[#191919] px-8 py-1.5 flex items-center gap-3">
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          <span className="text-[10px] text-neutral-300 dark:text-neutral-600">·</span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{charCount} chars</span>
          <span className="text-[10px] text-neutral-300 dark:text-neutral-600">·</span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{readMins} min read</span>
        </div>
      )}
    </div>
  )
}
