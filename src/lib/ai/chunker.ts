const CHUNK_SIZE = 500 * 4 // ~500 tokens, 4 chars per token
const MIN_PARAGRAPH_LENGTH = 20

export interface TextChunk {
  chunk_text: string
  chunk_index: number
  source_title: string
  source_type: 'note' | 'recording' | 'file'
}

export function chunkText(
  text: string,
  sourceTitle: string,
  sourceType: 'note' | 'recording' | 'file'
): TextChunk[] {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\s+\n/g, '\n')
    .trim()

  if (!cleaned || cleaned.length < MIN_PARAGRAPH_LENGTH) return []

  const paragraphs = cleaned
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_PARAGRAPH_LENGTH)

  if (paragraphs.length === 0) {
    // Fall back to splitting by single newline
    const lines = cleaned
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= MIN_PARAGRAPH_LENGTH)
    if (lines.length === 0) return []
    paragraphs.push(...lines)
  }

  const rawChunks: string[] = []
  let currentChunk = ''

  for (const para of paragraphs) {
    const combined = currentChunk ? currentChunk + '\n\n' + para : para

    if (combined.length <= CHUNK_SIZE) {
      currentChunk = combined
    } else {
      if (currentChunk) rawChunks.push(currentChunk)

      // If single paragraph is too large, split it by sentences
      if (para.length > CHUNK_SIZE) {
        const sentences = para.split(/(?<=[.!?])\s+/)
        let sentenceChunk = ''
        for (const sentence of sentences) {
          const combined = sentenceChunk ? sentenceChunk + ' ' + sentence : sentence
          if (combined.length <= CHUNK_SIZE) {
            sentenceChunk = combined
          } else {
            if (sentenceChunk) rawChunks.push(sentenceChunk)
            sentenceChunk = sentence
          }
        }
        if (sentenceChunk) currentChunk = sentenceChunk
        else currentChunk = ''
      } else {
        currentChunk = para
      }
    }
  }

  if (currentChunk) rawChunks.push(currentChunk)

  return rawChunks.map((text, index) => ({
    chunk_text: text,
    chunk_index: index,
    source_title: sourceTitle,
    source_type: sourceType,
  }))
}

export function extractPlainText(tiptapJson: Record<string, unknown>): string {
  let text = ''

  function traverse(node: Record<string, unknown>) {
    if (node.type === 'text' && typeof node.text === 'string') {
      text += node.text
    }
    if (node.type === 'hardBreak') {
      text += '\n'
    }
    if (
      ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock'].includes(
        node.type as string
      )
    ) {
      if (text && !text.endsWith('\n')) text += '\n'
    }

    const children = (node.content as Record<string, unknown>[]) || []
    for (const child of children) {
      traverse(child)
    }

    if (
      ['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type as string)
    ) {
      if (!text.endsWith('\n\n')) {
        text += text.endsWith('\n') ? '\n' : '\n\n'
      }
    }
  }

  traverse(tiptapJson)
  return text.trim()
}
