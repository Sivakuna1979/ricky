// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const SAFE_RANGES: Record<string, { min: number; max: number }> = {
  fridge_temp:      { min: 0, max: 8 },
  freezer_temp:     { min: -25, max: -18 },
  hot_holding_temp: { min: 63, max: 100 },
  cooking_temp:     { min: 75, max: 100 },
}

const schema = z.object({
  business_id: z.string().uuid(),
  van_id: z.string().uuid().optional(),
  log_type: z.enum(['fridge_temp', 'freezer_temp', 'hot_holding_temp', 'cooking_temp']),
  equipment_name: z.string().optional(),
  temperature_celsius: z.number(),
  corrective_action: z.string().optional(),
  recorded_at: z.coerce.date().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { log_type, temperature_celsius, recorded_at } = parsed.data
  const range = SAFE_RANGES[log_type]
  const is_within_range = temperature_celsius >= range.min && temperature_celsius <= range.max

  if (recorded_at && recorded_at.getTime() > Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: 'recorded_at cannot be in the future' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('temperature_logs')
    .insert({
      ...parsed.data,
      recorded_at: recorded_at ? recorded_at.toISOString() : undefined,
      is_within_range,
      min_safe_temp: range.min,
      max_safe_temp: range.max,
      recorded_by: userData!.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: userData!.id,
    action: 'hygiene.temperature_log',
    entity_type: 'temperature_logs',
    entity_id: data.id,
    new_values: { temperature_celsius, log_type, is_within_range },
  })

  return NextResponse.json(data, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const business_id = searchParams.get('business_id')
  const van_id = searchParams.get('van_id')
  const log_type = searchParams.get('log_type')
  const days = parseInt(searchParams.get('days') ?? '30')

  let query = supabase
    .from('temperature_logs')
    .select('*, users(full_name)')
    .gte('recorded_at', new Date(Date.now() - days * 86400000).toISOString())
    .order('recorded_at', { ascending: false })

  if (business_id) query = query.eq('business_id', business_id)
  if (van_id) query = query.eq('van_id', van_id)
  if (log_type) query = query.eq('log_type', log_type)

  const { data, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
