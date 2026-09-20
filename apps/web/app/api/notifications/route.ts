// @ts-nocheck
// Notification centre (D5) — reuses the existing user-scoped `notifications`
// table as-is; RLS already restricts a user to their own rows.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userData) return NextResponse.json({ error: 'User profile not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === '1'
  const category = searchParams.get('category')

  let query = supabase.from('notifications').select('*').eq('user_id', userData.id).order('sent_at', { ascending: false }).limit(100)
  if (unreadOnly) query = query.eq('is_read', false)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = category ? (data ?? []).filter((n: any) => n.data?.category === category) : (data ?? [])
  const unreadCount = (data ?? []).filter((n: any) => !n.is_read).length

  return NextResponse.json({ notifications: filtered, unread_count: unreadCount })
}

// Body: { mark_all_read: true } or { ids: string[] }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userData) return NextResponse.json({ error: 'User profile not found' }, { status: 404 })

  const body = await req.json()
  let query = supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', userData.id)
  if (Array.isArray(body.ids) && body.ids.length) query = query.in('id', body.ids)
  else if (!body.mark_all_read) return NextResponse.json({ error: 'ids or mark_all_read required' }, { status: 400 })

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
