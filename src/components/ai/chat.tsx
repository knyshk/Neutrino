'use client'

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react'
import { Send, Loader2, MessageSquare, ChevronDown, ChevronUp, BookOpen, Trash2 } from 'lucide-react'
import { AIMessage, SourceAttribution } from '@/types'
import { cn } from '@/lib/utils'

interface AIChatProps {
  noteId?: string
}

export function AIChat({ noteId }: AIChatProps) {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sessionUrl = noteId
    ? `/api/ai-session?scope_type=note&scope_id=${noteId}`
    : '/api/ai-session'

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(sessionUrl)
      if (res.ok) {
        const data = await res.json()
        if (data.session) {
          setMessages(data.session.messages || [])
          setSessionId(data.session.id)
        } else {
          setMessages([])
          setSessionId(null)
        }
      }
    } catch { /* non-critical */ } finally {
      setInitializing(false)
    }
  }, [sessionUrl])

  // Reload session when noteId changes
  useEffect(() => {
    setMessages([])
    setSessionId(null)
    setInitializing(true)
    loadSession()
  }, [noteId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function persistMessages(updatedMessages: AIMessage[], sid: string | null) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages,
            session_id: sid,
            scope_type: noteId ? 'note' : 'all',
            scope_id: noteId ?? null,
          }),
        })
        if (res.ok && !sid) {
          const data = await res.json()
          setSessionId(data.session_id)
        }
      } catch { /* non-critical */ }
    }, 800)
  }

  // Cancel any in-flight stream on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    // Abort any previous in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setInput('')
    setError(null)
    setLoading(true)

    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    }

    const messagesWithUser = [...messages, userMsg]
    setMessages(messagesWithUser)

    // Placeholder for the streaming assistant message
    const assistantId = crypto.randomUUID()
    const assistantMsg: AIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      created_at: new Date().toISOString(),
    }
    setMessages([...messagesWithUser, assistantMsg])

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          conversation_history: messages.slice(-10),
          ...(noteId ? { scope_type: 'note', scope_id: noteId } : {}),
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Query failed')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedContent = ''
      let sources: SourceAttribution[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          try {
            const event = JSON.parse(trimmed.slice(6))

            if (event.type === 'meta') {
              sources = event.sources || []
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, sources } : m)
              )
            } else if (event.type === 'token') {
              accumulatedContent += event.content
              const snap = accumulatedContent
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: snap } : m)
              )
            }
          } catch { /* malformed SSE line — skip */ }
        }
      }

      const finalMessages = messagesWithUser.concat({
        id: assistantId,
        role: 'assistant',
        content: accumulatedContent,
        sources,
        created_at: assistantMsg.created_at,
      })
      persistMessages(finalMessages, sessionId)
    } catch (err) {
      // AbortError means user navigated away — don't show error
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Something went wrong. Please try again.' }
            : m
        )
      )
      setError(String(err).replace('Error: ', ''))
    } finally {
      setLoading(false)
    }
  }

  async function handleClearHistory() {
    if (!confirmClear) { setConfirmClear(true); return }
    setConfirmClear(false)
    try {
      await fetch(sessionUrl, { method: 'DELETE' })
      setMessages([])
      setSessionId(null)
    } catch { /* non-critical */ }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  if (initializing) {
    return (
      <div className="flex flex-1 items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {messages.length > 0 && (
        <div className="flex items-center justify-end px-2 pt-1.5">
          <button
            onClick={handleClearHistory}
            onBlur={() => setConfirmClear(false)}
            className={cn(
              'flex items-center gap-1 text-[10px] transition-colors',
              confirmClear ? 'text-red-500' : 'text-neutral-400 hover:text-red-400'
            )}
            title={confirmClear ? 'Click again to confirm' : 'Clear history'}
          >
            <Trash2 size={10} />
            {confirmClear ? 'Confirm clear?' : 'Clear history'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
            <MessageSquare size={28} className="mb-3 text-neutral-300" />
            <p className="text-xs font-medium text-neutral-600">
              {noteId ? 'Ask about this note' : 'Ask anything about your notes'}
            </p>
            <p className="mt-1 text-[10px] text-neutral-400 leading-relaxed">
              {noteId
                ? 'Questions are answered using the content of this note.'
                : 'Questions are answered using your notes, recordings, and uploaded files.'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isStreaming={loading && msg.role === 'assistant' && msg === messages[messages.length - 1]} />
        ))}

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-100 p-2">
        <form onSubmit={handleSubmit} className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send)"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-violet-400 min-h-[32px] max-h-[80px] disabled:opacity-50"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = `${Math.min(t.scrollHeight, 80)}px`
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className={cn(
              'flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-lg transition-colors',
              input.trim() && !loading
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            )}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </form>
      </div>
    </div>
  )
}

function MessageBubble({ message, isStreaming }: { message: AIMessage; isStreaming: boolean }) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const isUser = message.role === 'user'
  const isEmpty = !message.content && isStreaming

  return (
    <div className={cn('flex items-start gap-2', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
          isUser ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-600'
        )}
      >
        {isUser ? 'Y' : 'AI'}
      </div>

      <div className={cn('max-w-[85%] space-y-1', isUser && 'items-end flex flex-col')}>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-xs leading-relaxed',
            isUser ? 'bg-violet-600 text-white' : 'bg-neutral-100 text-neutral-700'
          )}
        >
          {isEmpty ? (
            <span className="inline-flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          ) : (
            <p className="whitespace-pre-wrap">
              {message.content}
              {isStreaming && <span className="ml-0.5 inline-block h-3 w-0.5 bg-neutral-500 animate-pulse" />}
            </p>
          )}
        </div>

        {!isUser && !isEmpty && message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setSourcesOpen((o) => !o)}
              className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <BookOpen size={10} />
              {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
              {sourcesOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {sourcesOpen && (
              <div className="mt-1 space-y-1">
                {message.sources.map((src, i) => (
                  <SourceChip key={i} source={src} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SourceChip({ source }: { source: SourceAttribution }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 space-y-0.5">
      <p className="text-[10px] font-medium text-neutral-600 truncate">{source.source_title}</p>
      <p className="text-[10px] text-neutral-400 leading-relaxed line-clamp-2">{source.chunk_text}</p>
      <p className="text-[9px] text-neutral-300">
        {source.source_type} · {Math.round(source.similarity * 100)}% match
      </p>
    </div>
  )
}
