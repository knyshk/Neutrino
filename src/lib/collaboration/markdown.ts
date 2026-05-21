interface TiptapNode {
  type: string
  content?: TiptapNode[]
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

export function tiptapToMarkdown(content: Record<string, unknown>): string {
  const doc = content as { type: string; content?: TiptapNode[] }
  if (!doc.content) return ''
  return blockNodesToMarkdown(doc.content).trimEnd()
}

function blockNodesToMarkdown(nodes: TiptapNode[]): string {
  return nodes.map(blockNodeToMarkdown).join('')
}

function blockNodeToMarkdown(node: TiptapNode): string {
  switch (node.type) {
    case 'paragraph':
      if (!node.content || node.content.length === 0) return '\n'
      return inlineToMarkdown(node.content) + '\n\n'
    case 'heading': {
      const level = (node.attrs?.level as number) || 1
      const prefix = '#'.repeat(level)
      return `${prefix} ${inlineToMarkdown(node.content || [])}\n\n`
    }
    case 'bulletList':
      return (node.content || []).map((li) => `- ${listItemContent(li)}`).join('\n') + '\n\n'
    case 'orderedList':
      return (node.content || []).map((li, i) => `${i + 1}. ${listItemContent(li)}`).join('\n') + '\n\n'
    case 'blockquote':
      return (node.content || [])
        .map(blockNodeToMarkdown)
        .join('')
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n') + '\n'
    case 'codeBlock': {
      const lang = (node.attrs?.language as string) || ''
      const code = node.content?.[0]?.text || ''
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`
    }
    case 'horizontalRule':
      return '---\n\n'
    case 'hardBreak':
      return '\n'
    case 'taskList':
      return (node.content || []).map((li) => {
        const checked = li.attrs?.checked ? '[x]' : '[ ]'
        return `- ${checked} ${listItemContent(li)}`
      }).join('\n') + '\n\n'
    default:
      return inlineToMarkdown(node.content || [])
  }
}

function listItemContent(li: TiptapNode): string {
  const first = li.content?.[0]
  if (!first) return ''
  return inlineToMarkdown(first.content || []).trim()
}

function inlineToMarkdown(nodes: TiptapNode[]): string {
  return nodes.map(inlineNodeToMarkdown).join('')
}

function inlineNodeToMarkdown(node: TiptapNode): string {
  if (node.type === 'hardBreak') return '\n'
  if (node.type !== 'text') return blockNodesToMarkdown(node.content || [])

  let text = node.text || ''
  const marks = node.marks || []

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold': text = `**${text}**`; break
      case 'italic': text = `_${text}_`; break
      case 'strike': text = `~~${text}~~`; break
      case 'code': text = `\`${text}\``; break
      case 'underline': break // No markdown equivalent
      case 'link': {
        const href = mark.attrs?.href as string || '#'
        text = `[${text}](${href})`
        break
      }
      case 'highlight': text = `==${text}==`; break
    }
  }

  return text
}
