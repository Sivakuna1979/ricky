// @ts-nocheck
// I14 — server-controlled redemption. Validates balance/eligibility
// inside the atomic apply_loyalty_transaction RPC (see the migration) —
// never trusts a client-claimed balance.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { redeemLoyaltyReward } from '@/lib/crm/loyalty'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { crm_customer_id }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_loyalty')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { crm_customer_id } = await req.json()
  if (!crm_customer_id) return NextResponse.json({ error: 'crm_customer_id is required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: customer } = await admin.from('crm_customers').select('id').eq('id', crm_customer_id).eq('business_id', ctx.businessId).maybeSingle()
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  try {
    const result = await redeemLoyaltyReward(admin, ctx.businessId, crm_customer_id, ctx.userId)
    await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.loyalty_redeemed', entityType: 'crm_customers', entityId: crm_customer_id, newValues: result })
    return NextResponse.json(result)
  } catch (e: any) {
    const message = e.message?.includes('insufficient_balance') ? 'Not enough points for this reward.' : 'Could not redeem right now.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
