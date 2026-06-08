// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Opening/closing checklist items
export const OPENING_CHECKLIST = [
  'Wash hands before starting work',
  'Check fridge temperature (must be 0–8°C)',
  'Check freezer temperature (must be -18°C or below)',
  'Inspect all food for freshness and use-by dates',
  'Check van/equipment is clean',
  'Check hot holding equipment is working',
  'Check first aid kit is stocked',
  'Review allergen information is up to date',
  'Staff personal hygiene check complete',
  'All surfaces sanitised',
]

export const CLOSING_CHECKLIST = [
  'All food stored correctly and covered',
  'Temperatures logged',
  'All surfaces cleaned and sanitised',
  'Equipment cleaned and stored',
  'Waste disposed of correctly',
  'Cold storage doors closed and locked',
  'Gas/electric turned off',
  'Van secured',
]

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
