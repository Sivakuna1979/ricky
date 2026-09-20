// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { endRouteSession } from '@/lib/routes/sessions'

// Body: { status: 'completed' } — ends the route (G9).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const admin = await createAdminClient()
  const { data: session } = await admin.from('route_sessions').select('id, business_id').eq('id', params.id).maybeSingle()
  if (!session || session.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (body.status === 'completed') await endRouteSession(admin, params.id, ctx.userId)

  const { data: updated } = await admin.from('route_sessions').select('*').eq('id', params.id).maybeSingle()
  return NextResponse.json(updated)
}
