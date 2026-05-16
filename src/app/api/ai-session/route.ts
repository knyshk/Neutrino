import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AIMessage } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: session } = await supabase
    .from('ai_sessions')
    .select('id, messages')
    .eq('user_id', user.id)
    .eq('scope_type', 'all')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ session: session ?? null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages, session_id }: { messages: AIMessage[]; session_id?: string } = await request.json()

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
    .insert({ user_id: user.id, messages, scope_type: 'all' })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ session_id: session.id })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await supabase
    .from('ai_sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('scope_type', 'all')

  return NextResponse.json({ success: true })
}
