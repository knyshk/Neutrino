import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get file to find storage path
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('storage_url, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  // Delete chunks
  await supabase.from('chunks').delete().eq('file_id', id).eq('user_id', user.id)

  // Delete from storage (extract path from URL)
  try {
    const url = new URL(file.storage_url)
    const pathParts = url.pathname.split('/documents/')
    if (pathParts[1]) {
      await supabase.storage.from('documents').remove([pathParts[1]])
    }
  } catch {
    // Non-critical — continue with DB deletion
  }

  // Delete file record
  const { error: deleteError } = await supabase
    .from('files')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
