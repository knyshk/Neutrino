'use client'

import { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Code2,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  CheckSquare,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Link2,
  Image,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'

interface ToolbarProps {
  editor: Editor | null
}

interface ToolbarButton {
  label: string
  icon: React.ReactNode
  action: () => void
  isActive?: boolean
  disabled?: boolean
}

function Divider() {
  return <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-1" />
}

function ToolbarBtn({ item }: { item: ToolbarButton }) {
  return (
    <button
      type="button"
      title={item.label}
      disabled={item.disabled}
      onClick={item.action}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        'hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-40',
        item.isActive
          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400'
          : 'text-neutral-600 dark:text-neutral-400'
      )}
    >
      {item.icon}
    </button>
  )
}

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function openPopover() {
    const existing = editor.getAttributes('link').href as string | undefined
    setHref(existing ?? '')
    setOpen(true)
  }

  function apply() {
    if (href.trim()) {
      editor.chain().focus().setLink({ href: href.trim() }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setOpen(false)
  }

  function remove() {
    editor.chain().focus().unsetLink().run()
    setOpen(false)
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        title="Link"
        onClick={openPopover}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          'hover:bg-neutral-100 dark:hover:bg-neutral-800',
          editor.isActive('link') ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' : 'text-neutral-600 dark:text-neutral-400'
        )}
      >
        <Link2 size={15} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 flex gap-1 min-w-[220px]">
          <input
            ref={inputRef}
            type="url"
            value={href}
            onChange={e => setHref(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') apply()
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="https://..."
            className="flex-1 text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-violet-400 min-w-0"
          />
          <button
            type="button"
            onClick={apply}
            className="text-xs px-2 py-1 bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors shrink-0"
          >
            Apply
          </button>
          {editor.isActive('link') && (
            <button
              type="button"
              onClick={remove}
              className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded hover:bg-neutral-200 transition-colors shrink-0"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function ImageButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function openPopover() {
    setSrc('')
    setOpen(true)
  }

  function apply() {
    if (src.trim()) {
      editor.chain().focus().setImage({ src: src.trim() }).run()
    }
    setOpen(false)
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        title="Image"
        onClick={openPopover}
        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-neutral-100 text-neutral-600"
      >
        <Image size={15} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 flex gap-1 min-w-[220px]">
          <input
            ref={inputRef}
            type="url"
            value={src}
            onChange={e => setSrc(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') apply()
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="Image URL..."
            className="flex-1 text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-violet-400 min-w-0"
          />
          <button
            type="button"
            onClick={apply}
            className="text-xs px-2 py-1 bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors shrink-0"
          >
            Insert
          </button>
        </div>
      )}
    </div>
  )
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null

  const historyButtons: ToolbarButton[] = [
    {
      label: 'Undo',
      icon: <Undo size={15} />,
      action: () => editor.chain().focus().undo().run(),
      disabled: !editor.can().undo(),
    },
    {
      label: 'Redo',
      icon: <Redo size={15} />,
      action: () => editor.chain().focus().redo().run(),
      disabled: !editor.can().redo(),
    },
  ]

  const headingButtons: ToolbarButton[] = [
    {
      label: 'Heading 1',
      icon: <Heading1 size={15} />,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
    },
    {
      label: 'Heading 2',
      icon: <Heading2 size={15} />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    {
      label: 'Heading 3',
      icon: <Heading3 size={15} />,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
    },
  ]

  const inlineButtons: ToolbarButton[] = [
    {
      label: 'Bold',
      icon: <Bold size={15} />,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      label: 'Italic',
      icon: <Italic size={15} />,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      label: 'Underline',
      icon: <Underline size={15} />,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
    },
    {
      label: 'Strikethrough',
      icon: <Strikethrough size={15} />,
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
    },
    {
      label: 'Inline code',
      icon: <Code size={15} />,
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive('code'),
    },
    {
      label: 'Highlight',
      icon: <Highlighter size={15} />,
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: editor.isActive('highlight'),
    },
  ]

  const blockButtons: ToolbarButton[] = [
    {
      label: 'Bullet list',
      icon: <List size={15} />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      label: 'Numbered list',
      icon: <ListOrdered size={15} />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
    },
    {
      label: 'Task list',
      icon: <CheckSquare size={15} />,
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: editor.isActive('taskList'),
    },
    {
      label: 'Blockquote',
      icon: <Quote size={15} />,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
    },
    {
      label: 'Code block',
      icon: <Code2 size={15} />,
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
    },
  ]

  const alignButtons: ToolbarButton[] = [
    {
      label: 'Align left',
      icon: <AlignLeft size={15} />,
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: editor.isActive({ textAlign: 'left' }),
    },
    {
      label: 'Align center',
      icon: <AlignCenter size={15} />,
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: editor.isActive({ textAlign: 'center' }),
    },
    {
      label: 'Align right',
      icon: <AlignRight size={15} />,
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: editor.isActive({ textAlign: 'right' }),
    },
  ]

  const insertButtons: ToolbarButton[] = [
    {
      label: 'Horizontal rule',
      icon: <Minus size={15} />,
      action: () => editor.chain().focus().setHorizontalRule().run(),
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5">
      {historyButtons.map(btn => <ToolbarBtn key={btn.label} item={btn} />)}
      <Divider />
      {headingButtons.map(btn => <ToolbarBtn key={btn.label} item={btn} />)}
      <Divider />
      {inlineButtons.map(btn => <ToolbarBtn key={btn.label} item={btn} />)}
      <Divider />
      {blockButtons.map(btn => <ToolbarBtn key={btn.label} item={btn} />)}
      <Divider />
      {alignButtons.map(btn => <ToolbarBtn key={btn.label} item={btn} />)}
      <Divider />
      {insertButtons.map(btn => <ToolbarBtn key={btn.label} item={btn} />)}
      <LinkButton editor={editor} />
      <ImageButton editor={editor} />
    </div>
  )
}
