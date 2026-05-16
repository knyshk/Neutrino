'use client'

import { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null

  const buttons: (ToolbarButton | 'divider')[] = [
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
    'divider',
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
    'divider',
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
    'divider',
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
      label: 'Blockquote',
      icon: <Quote size={15} />,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-100 px-3 py-1.5">
      {buttons.map((item, index) => {
        if (item === 'divider') {
          return (
            <div
              key={`divider-${index}`}
              className="mx-1 h-5 w-px bg-neutral-200"
            />
          )
        }

        return (
          <button
            key={item.label}
            type="button"
            title={item.label}
            disabled={item.disabled}
            onClick={item.action}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              'hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-40',
              item.isActive
                ? 'bg-violet-100 text-violet-700'
                : 'text-neutral-600'
            )}
          >
            {item.icon}
          </button>
        )
      })}
    </div>
  )
}
