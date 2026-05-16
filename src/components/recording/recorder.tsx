'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Pause, Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Recording, Note } from '@/types'
import { formatDuration, cn } from '@/lib/utils'

interface RecorderProps {
  onTranscriptReady: (recording: Recording, note: Note) => void
}

type RecordState = 'idle' | 'recording' | 'paused' | 'transcribing' | 'done' | 'error'

export function Recorder({ onTranscriptReady }: RecorderProps) {
  const [state, setState] = useState<RecordState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [title, setTitle] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function startRecording() {
    setErrorMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorder.current = recorder
      chunks.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.start(1000) // collect data every second
      setState('recording')

      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch (err) {
      if (String(err).includes('Permission') || String(err).includes('NotAllowed')) {
        setPermissionDenied(true)
        setErrorMessage('Microphone access denied. Please allow microphone access in your browser settings.')
      } else {
        setErrorMessage('Could not start recording: ' + String(err))
      }
      setState('error')
    }
  }

  function pauseRecording() {
    mediaRecorder.current?.pause()
    if (timerRef.current) clearInterval(timerRef.current)
    setState('paused')
  }

  function resumeRecording() {
    mediaRecorder.current?.resume()
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    setState('recording')
  }

  async function stopAndTranscribe() {
    if (!mediaRecorder.current) return

    if (timerRef.current) clearInterval(timerRef.current)
    setState('transcribing')

    await new Promise<void>((resolve) => {
      mediaRecorder.current!.onstop = () => resolve()
      mediaRecorder.current!.stop()
    })

    streamRef.current?.getTracks().forEach((t) => t.stop())

    const mimeType = mediaRecorder.current.mimeType || 'audio/webm'
    const audioBlob = new Blob(chunks.current, { type: mimeType })

    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')
    formData.append('title', title || `Recording ${new Date().toLocaleDateString()}`)

    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Transcription failed')
      }

      setState('done')
      onTranscriptReady(data.recording, data.note)

      setTimeout(() => {
        setState('idle')
        setElapsed(0)
        setTitle('')
      }, 3000)
    } catch (err) {
      setErrorMessage(String(err).replace('Error: ', ''))
      setState('error')
    }
  }

  function reset() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    setState('idle')
    setElapsed(0)
    setTitle('')
    setErrorMessage(null)
    chunks.current = []
  }

  if (state === 'idle') {
    return (
      <div className="p-2 space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Recording title (optional)"
          className="h-7 w-full rounded-md border border-neutral-200 bg-white px-2.5 text-xs text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
        <button
          onClick={startRecording}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600 transition-colors"
        >
          <Mic size={13} />
          Start Recording
        </button>
        {permissionDenied && (
          <p className="text-[10px] text-red-500 text-center">
            Allow microphone access in browser settings, then refresh.
          </p>
        )}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="p-2 space-y-2">
        <div className="rounded-lg bg-red-50 p-3 flex items-start gap-2">
          <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-600">{errorMessage}</p>
        </div>
        <button onClick={reset} className="w-full text-xs text-neutral-500 hover:text-neutral-700 underline">
          Try again
        </button>
      </div>
    )
  }

  if (state === 'transcribing') {
    return (
      <div className="flex flex-col items-center gap-2 p-4">
        <Loader2 size={20} className="animate-spin text-violet-500" />
        <p className="text-xs text-neutral-600 text-center">Transcribing your recording…</p>
        <p className="text-[10px] text-neutral-400">This may take a moment</p>
      </div>
    )
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col items-center gap-2 p-4">
        <CheckCircle size={20} className="text-green-500" />
        <p className="text-xs text-green-700 text-center font-medium">Transcript ready!</p>
        <p className="text-[10px] text-neutral-400">Note created in your workspace</p>
      </div>
    )
  }

  // recording or paused
  return (
    <div className="p-2 space-y-2">
      <div className={cn(
        'flex items-center justify-between rounded-lg px-3 py-2',
        state === 'recording' ? 'bg-red-50' : 'bg-neutral-100'
      )}>
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', state === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-neutral-400')} />
          <span className="text-xs font-mono font-medium text-neutral-700">
            {formatDuration(elapsed)}
          </span>
        </div>
        <span className="text-[10px] text-neutral-500">
          {state === 'recording' ? 'Recording…' : 'Paused'}
        </span>
      </div>

      <div className="flex gap-1.5">
        {state === 'recording' ? (
          <button
            onClick={pauseRecording}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-200 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <Pause size={12} /> Pause
          </button>
        ) : (
          <button
            onClick={resumeRecording}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-200 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <Play size={12} /> Resume
          </button>
        )}
        <button
          onClick={stopAndTranscribe}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-neutral-800 py-1.5 text-xs text-white hover:bg-neutral-900 transition-colors"
        >
          <Square size={12} /> Stop & Transcribe
        </button>
      </div>
    </div>
  )
}

export function RecordingListItem({ recording }: { recording: Recording }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-neutral-100 transition-colors">
      <Mic size={13} className={recording.transcription_status === 'done' ? 'text-violet-500' : 'text-neutral-400'} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium text-neutral-700">{recording.title}</p>
        <p className="text-[10px] text-neutral-400">
          {recording.transcription_status === 'done'
            ? 'Transcribed'
            : recording.transcription_status === 'failed'
            ? '⚠ Failed'
            : 'Processing…'}
        </p>
      </div>
    </div>
  )
}
