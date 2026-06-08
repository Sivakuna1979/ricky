// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/tracking/[vanId]/location
// Called by the driver app every few seconds
export async function POST(
  req: NextRequest,
  { params }: { params: { vanId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { latitude, longitude, heading, speed, accuracy } = body

  if (!latitude || !longitude) {
    return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  // Insert location (RLS ensures only allowed drivers can post)
  const { error } = await supabase.from('live_locations').insert({
    van_id: params.vanId,
    driver_id: userData?.id,
    latitude,
    longitude,
    heading,
    speed,
    accuracy,
    recorded_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update van tracking_status to live
  await supabase
    .from('vans')
    .update({ tracking_status: 'live' })
    .eq('id', params.vanId)

  return NextResponse.json({ ok: true })
}

// GET /api/tracking/[vanId]/location — returns latest location
export async function GET(
  req: NextRequest,
  { params }: { params: { vanId: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('live_locations')
    .select('*')
    .eq('van_id', params.vanId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return NextResponse.json({ location: null })
  return NextResponse.json(data)
}
