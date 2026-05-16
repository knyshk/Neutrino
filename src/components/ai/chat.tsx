'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Send, Loader2, MessageSquare, ChevronDown, ChevronUp, BookOpen, Trash2 } from 'lucide-react'
import { AIMessage, SourceAttribution } from '@/types'
import { cn } from '@/lib/utils'

export function AIChat() {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load persisted session on mount
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/ai-session')
        if (res.ok) {
          const data = await res.json()
          if (data.session) {
            setMessages(data.session.messages || [])
            setSessionId(data.session.id)
          }
        }
      } catch { /* non-critical */ } finally {
        setInitializing(false)
      }
    }
    loadSession()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Debounced persist after every message update
  function persistMessages(updatedMessages: AIMessage[], sid: string | null) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updatedMessages, session_id: sid }),
        })
        if (res.ok) {
          const data = await res.json()
          if (!sid) setSessionId(data.session_id)
        }
      } catch { /* non-critical */ }
    }, 800)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setError(null)

    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    }

    const updatedWithUser = [...messages, userMsg]
    setMessages(updatedWithUser)
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          conversation_history: messages.slice(-10), // last 5 turns
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Query failed')
      }

      const assistantMsg: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        created_at: new Date().toISOString(),
      }

      const finalMessages = [...updatedWithUser, assistantMsg]
      setMessages(finalMessages)
      persistMessages(finalMessages, sessionId)
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
      // Still persist user message even on error
      persistMessages(updatedWithUser, sessionId)
    } finally {
      setLoading(false)
    }
  }

  async function handleClearHistory() {
    if (!confirm('Clear your entire chat history? This cannot be undone.')) return
    try {
      await fetch('/api/ai-session', { method: 'DELETE' })
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
      {/* Header with clear button */}
      {messages.length > 0 && (
        <div className="flex items-center justify-end px-2 pt-1.5">
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={10} />
            Clear history
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
            <MessageSquare size={28} className="mb-3 text-neutral-300" />
            <p className="text-xs font-medium text-neutral-600">Ask anything about your notes</p>
            <p className="mt-1 text-[10px] text-neutral-400 leading-relaxed">
              Questions are answered using your notes, recordings, and uploaded files.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100">
              <div className="h-2 w-2 rounded-full bg-violet-500" />
            </div>
            <div className="rounded-lg bg-neutral-100 px-3 py-2">
              <Loader2 size={13} className="animate-spin text-neutral-500" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
            <p className="text-[11px] text-red-600">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-100 p-2">
        <form onSubmit={handleSubmit} className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-violet-400 min-h-[32px] max-h-[80px]"
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

function MessageBubble({ message }: { message: AIMessage }) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const isUser = message.role === 'user'

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
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {!isUser && message.sources && message.sources.length > 0 && (
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
