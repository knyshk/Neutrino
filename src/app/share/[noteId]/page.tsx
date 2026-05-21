import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { PublicNoteViewer } from './public-note-viewer'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ noteId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { noteId } = await params
  const serviceClient = await createServiceClient()
  const { data: note } = await serviceClient
    .from('notes')
    .select('title')
    .eq('id', noteId)
    .eq('is_public', true)
    .single()

  if (!note) return { title: 'Note not found' }
  return {
    title: note.title || 'Shared note',
    description: `Read "${note.title}" on Neutrino`,
  }
}

export default async function SharePage({ params }: PageProps) {
  const { noteId } = await params
  const serviceClient = await createServiceClient()

  const { data: note } = await serviceClient
    .from('notes')
    .select('id, title, content, content_text, updated_at, user_id')
    .eq('id', noteId)
    .eq('is_public', true)
    .eq('is_deleted', false)
    .single()

  if (!note) notFound()

  const { data: ownerProfile } = await serviceClient
    .from('user_profiles')
    .select('display_name')
    .eq('id', note.user_id)
    .single()

  return (
    <PublicNoteViewer
      note={note as { id: string; title: string; content: Record<string, unknown> | null; updated_at: string }}
      ownerName={ownerProfile?.display_name ?? null}
    />
  )
}
