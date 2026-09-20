// @ts-nocheck
// Vehicle management (C22) — extends the existing `vans` table (which
// already has registration_plate) via a 1:1 vehicle_details row; it does
// not create a second van identity.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data: vans, error } = await supabase
    .from('vans').select('id, name, registration_plate, vehicle_details(*)').eq('business_id', ctx.businessId).order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(vans)
}
