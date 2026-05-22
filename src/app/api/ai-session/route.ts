import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AIMessage } from '@/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const scopeType = searchParams.get('scope_type') || 'all'
  const scopeId = searchParams.get('scope_id') || null

  let query = supabase
    .from('ai_sessions')
    .select('id, messages')
    .eq('user_id', user.id)
    .eq('scope_type', scopeType)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (scopeId) {
    query = query.eq('scope_id', scopeId)
  } else {
    query = query.is('scope_id', null)
  }

  const { data: session } = await query.single()

  return NextResponse.json({ session: session ?? null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const {
    messages,
    session_id,
    scope_type = 'all',
    scope_id = null,
  }: { messages: AIMessage[]; session_id?: string; scope_type?: string; scope_id?: string | null } = await request.json()

  if (session_id) {
    const { data: session, error } = await supabase
      .from('ai_sessions')
      .update({ messages, updated_at: new Date().toISOString() })
      .eq('id', session_id)
      .eq('user_id', user.id)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ session_id: session.id })
  }

  const { data: session, error } = await supabase
    .from('ai_sessions')
    .insert({ user_id: user.id, messages, scope_type, scope_id })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session_id: session.id })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const scopeType = searchParams.get('scope_type') || 'all'
  const scopeId = searchParams.get('scope_id') || null

  let query = supabase
    .from('ai_sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('scope_type', scopeType)

  if (scopeId) {
    query = query.eq('scope_id', scopeId)
  } else {
    query = query.is('scope_id', null)
  }

  await query

  return NextResponse.json({ success: true })
}
