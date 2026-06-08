// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
  const body = await req.json()

  const { business_id, van_id, checklist_type, items, digital_signature, notes } = body

  // items: [{ label: string, completed: boolean }]
  const allCompleted = items.every((i: { completed: boolean }) => i.completed)

  const { data, error } = await supabase
    .from('hygiene_logs')
    .insert({
      business_id,
      van_id,
      log_type: checklist_type, // 'opening_checklist' | 'closing_checklist'
      recorded_by: userData!.id,
      data: { items },
      digital_signature,
      notes,
      is_compliant: allCompleted,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const business_id = searchParams.get('business_id')
  const checklist_type = searchParams.get('type') ?? 'opening_checklist'

  const { data, error } = await supabase
    .from('hygiene_logs')
    .select('*, users(full_name)')
    .eq('business_id', business_id!)
    .eq('log_type', checklist_type)
    .order('recorded_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
