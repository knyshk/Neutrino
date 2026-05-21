'use client'

import { useState, useRef, DragEvent } from 'react'
import { Upload, FileText, File, AlertCircle, CheckCircle, X, Loader2, RotateCcw } from 'lucide-react'
import { UploadedFile } from '@/types'
import { formatFileSize, cn } from '@/lib/utils'

interface FileUploadProps {
  onUploadComplete: (file: UploadedFile) => void
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!allowed.includes(file.type)) {
      setErrorMessage('Only PDF, DOCX, and TXT files are supported.')
      setUploadState('error')
      return
    }

    setUploadState('uploading')
    setProgress(10)
    setUploadedFileName(file.name)
    setErrorMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      setProgress(40)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      setProgress(80)

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      if (data.extraction_error) {
        setErrorMessage(data.extraction_error)
        setUploadState('error')
        return
      }

      setProgress(100)
      setUploadState('done')
      onUploadComplete(data.file)

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadState('idle')
        setProgress(0)
        setUploadedFileName(null)
      }, 3000)
    } catch (err) {
      setErrorMessage(String(err).replace('Error: ', ''))
      setUploadState('error')
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div className="p-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => uploadState === 'idle' && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
          dragOver ? 'border-violet-400 bg-violet-50' : 'border-neutral-200 hover:border-violet-300 hover:bg-neutral-50',
          uploadState === 'uploading' && 'pointer-events-none',
          uploadState === 'done' && 'border-green-300 bg-green-50',
          uploadState === 'error' && 'border-red-300 bg-red-50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={handleInputChange}
        />

        {uploadState === 'idle' && (
          <>
            <Upload size={20} className="mb-2 text-neutral-400" />
            <p className="text-xs font-medium text-neutral-600">Drop file here or click to browse</p>
            <p className="mt-1 text-[10px] text-neutral-400">PDF, DOCX, TXT — up to 10MB</p>
          </>
        )}

        {uploadState === 'uploading' && (
          <>
            <Loader2 size={20} className="mb-2 animate-spin text-violet-500" />
            <p className="text-xs font-medium text-neutral-600">Uploading {uploadedFileName}…</p>
            <div className="mt-2 h-1 w-full rounded-full bg-neutral-200">
              <div
                className="h-1 rounded-full bg-violet-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}

        {uploadState === 'done' && (
          <>
            <CheckCircle size={20} className="mb-2 text-green-500" />
            <p className="text-xs font-medium text-green-700">File ready — AI can now query it</p>
          </>
        )}

        {uploadState === 'error' && (
          <>
            <AlertCircle size={20} className="mb-2 text-red-400" />
            <p className="text-xs font-medium text-red-600">{errorMessage}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setUploadState('idle'); setErrorMessage(null) }}
              className="mt-2 text-[10px] text-red-400 underline"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function FileListItem({
  file,
  onDelete,
  onReembedSuccess,
}: {
  file: UploadedFile
  onDelete: (id: string) => void
  onReembedSuccess?: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [reembedding, setReembedding] = useState(false)
  const [status, setStatus] = useState(file.extraction_status)

  async function handleDelete() {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/files/${file.id}`, { method: 'DELETE' })
      onDelete(file.id)
    } finally {
      setDeleting(false)
    }
  }

  async function handleReembed() {
    setReembedding(true)
    try {
      const res = await fetch(`/api/files/${file.id}/reembed`, { method: 'POST' })
      if (res.ok) {
        setStatus('done')
        onReembedSuccess?.(file.id)
      }
    } finally {
      setReembedding(false)
    }
  }

  const Icon = file.file_type === 'pdf' ? FileText : File

  return (
    <div className="group flex items-center gap-2 rounded-md px-3 py-2 hover:bg-neutral-100 transition-colors">
      <Icon size={13} className={status === 'done' ? 'text-violet-500' : 'text-neutral-400'} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-medium text-neutral-700">{file.name}</p>
        <p className="text-[10px] text-neutral-400">
          {formatFileSize(file.file_size_bytes ?? 0)} ·{' '}
          {status === 'done' ? 'Ready' : status === 'failed' ? '⚠ Failed' : 'Processing…'}
        </p>
      </div>
      <div className="hidden group-hover:flex items-center gap-1">
        {status === 'failed' && (
          <button
            onClick={handleReembed}
            disabled={reembedding}
            className="h-5 w-5 flex items-center justify-center rounded text-neutral-300 hover:text-violet-500 transition-colors"
            title="Re-embed file"
          >
            {reembedding ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="h-5 w-5 flex items-center justify-center rounded text-neutral-300 hover:text-red-400 transition-colors"
        >
          {deleting ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
        </button>
      </div>
    </div>
  )
}
