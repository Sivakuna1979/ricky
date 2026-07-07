// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Allowed extra record types (values of the hygiene_log_type enum)
const TYPES = ['supplier', 'maintenance', 'haccp', 'cleaning', 'staff_hygiene', 'daily_hygiene']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
  const { business_id, van_id, log_type, data, notes, digital_signature, is_compliant } = await req.json()
  if (!business_id || !TYPES.includes(log_type)) return NextResponse.json({ error: 'Invalid log' }, { status: 400 })

  const { data: row, error } = await supabase
    .from('hygiene_logs')
    .insert({
      business_id,
      van_id,
      log_type,
      recorded_by: userData!.id,
      data: data ?? {},
      notes,
      digital_signature,
      is_compliant: is_compliant ?? true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_logs').insert({
    actor_id: userData!.id,
    action: `hygiene.${log_type}`,
    entity_type: 'hygiene_logs',
    entity_id: row.id,
    new_values: { log_type, is_compliant: row.is_compliant },
  }).catch?.(() => {})

  return NextResponse.json(row, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const business_id = searchParams.get('business_id')
  const types = (searchParams.get('types') ?? 'supplier,maintenance,haccp').split(',').filter(t => TYPES.includes(t))
  const days = parseInt(searchParams.get('days') ?? '90')

  const { data, error } = await supabase
    .from('hygiene_logs')
    .select('*, users(full_name)')
    .eq('business_id', business_id!)
    .in('log_type', types)
    .gte('recorded_at', new Date(Date.now() - days * 86400000).toISOString())
    .order('recorded_at', { ascending: false })
    .limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
