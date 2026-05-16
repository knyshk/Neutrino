'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Toolbar } from './toolbar'
import { Note } from '@/types'
import { cn } from '@/lib/utils'

interface TipTapEditorProps {
  note: Note
  onSave: (content: Record<string, unknown>, contentText: string) => Promise<void>
  readOnly?: boolean
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'

export function TipTapEditor({ note, onSave, readOnly = false }: TipTapEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef<string>(JSON.stringify(note.content))

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing…',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: note.content || '',
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
          const text = editor.getText()
          await onSave(content as Record<string, unknown>, text)
          lastSavedContent.current = contentStr
          setSaveStatus('saved')
        } catch {
          setSaveStatus('unsaved')
        }
      }, 2000)
    },
  })

  useEffect(() => {
    if (!editor) return
    const currentContent = JSON.stringify(editor.getJSON())
    const newContent = JSON.stringify(note.content)
    if (currentContent !== newContent) {
      editor.commands.setContent(note.content || '')
      lastSavedContent.current = newContent
      setSaveStatus('saved')
    }
  }, [editor, note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

  return (
    <div className="flex h-full flex-col">
      {!readOnly && (
        <div className="flex items-center justify-between border-b border-neutral-100 bg-white">
          <Toolbar editor={editor} />
          <div className="px-4 py-2">
            <span
              className={cn('text-xs transition-colors', {
                'text-neutral-400': saveStatus === 'saved',
                'text-amber-500': saveStatus === 'saving' || saveStatus === 'unsaved',
              })}
            >
              {saveStatus === 'saved' && 'Saved'}
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'unsaved' && 'Unsaved changes'}
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}
