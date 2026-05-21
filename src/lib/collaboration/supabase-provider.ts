'use client'

import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface CollabUser {
  name: string
  color: string
  email: string
}

const CURSOR_COLORS = [
  '#7c3aed', '#dc2626', '#059669', '#d97706',
  '#2563eb', '#db2777', '#0891b2', '#65a30d',
]

export function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

export class SupabaseProvider {
  readonly doc: Y.Doc
  readonly awareness: Awareness

  private noteId: string
  private channel: RealtimeChannel | null = null
  private supabase = createClient()
  private synced = false

  private onAwarenessChange?: () => void

  constructor(doc: Y.Doc, noteId: string, user: CollabUser, onAwarenessChange?: () => void) {
    this.doc = doc
    this.noteId = noteId
    this.awareness = new Awareness(doc)
    this.onAwarenessChange = onAwarenessChange

    this.awareness.setLocalStateField('user', user)

    this.connect()
  }

  private connect() {
    const channel = this.supabase.channel(`note-collab:${this.noteId}`, {
      config: { broadcast: { self: false, ack: false } },
    })

    // Receive incremental Yjs updates from peers
    channel.on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
      try {
        Y.applyUpdate(this.doc, new Uint8Array(payload.update as number[]), 'remote')
      } catch { /* malformed update — ignore */ }
    })

    // Receive full state from a peer (after we requested it on join)
    channel.on('broadcast', { event: 'full-state' }, ({ payload }) => {
      if (!this.synced) {
        try {
          Y.applyUpdate(this.doc, new Uint8Array(payload.state as number[]), 'remote')
        } catch { /* ignore */ }
        this.synced = true
      }
    })

    // Someone new joined — send them our current full state
    channel.on('broadcast', { event: 'request-state' }, () => {
      const state = Y.encodeStateAsUpdate(this.doc)
      channel.send({
        type: 'broadcast',
        event: 'full-state',
        payload: { state: Array.from(state) },
      })
    })

    // Receive awareness (cursors/presence) from peers
    channel.on('broadcast', { event: 'awareness' }, ({ payload }) => {
      try {
        applyAwarenessUpdate(this.awareness, new Uint8Array(payload.update as number[]), 'remote')
        this.onAwarenessChange?.()
      } catch { /* ignore */ }
    })

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return

      // Ask existing editors for their current state
      await channel.send({ type: 'broadcast', event: 'request-state', payload: {} })

      // Broadcast our presence
      const awarenessState = encodeAwarenessUpdate(this.awareness, [this.doc.clientID])
      await channel.send({
        type: 'broadcast',
        event: 'awareness',
        payload: { update: Array.from(awarenessState) },
      })

      // If no peer responds within 1.5s we're alone — mark as synced (content from DB is authoritative)
      setTimeout(() => {
        if (!this.synced) this.synced = true
      }, 1500)
    })

    // Broadcast local Yjs updates to peers
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      channel.send({
        type: 'broadcast',
        event: 'yjs-update',
        payload: { update: Array.from(update) },
      })
    })

    // Broadcast local awareness changes
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changed = [...added, ...updated, ...removed]
      const update = encodeAwarenessUpdate(this.awareness, changed)
      channel.send({
        type: 'broadcast',
        event: 'awareness',
        payload: { update: Array.from(update) },
      })
      this.onAwarenessChange?.()
    })

    this.channel = channel
  }

  getRemoteUsers(): CollabUser[] {
    const states = this.awareness.getStates()
    const users: CollabUser[] = []
    states.forEach((state, clientId) => {
      if (clientId !== this.doc.clientID && state.user) {
        users.push(state.user as CollabUser)
      }
    })
    return users
  }

  destroy() {
    if (this.channel) {
      removeAwarenessStates(this.awareness, [this.doc.clientID], 'destroy')
      this.supabase.removeChannel(this.channel)
      this.channel = null
    }
    this.awareness.destroy()
  }
}
