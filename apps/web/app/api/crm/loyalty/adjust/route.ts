// @ts-nocheck
// I11 — manual loyalty adjustment. Sits above manage_loyalty
// (adjust_loyalty) since it can move a balance in either direction
// without an order behind it — a business-admin+ action, always
// audited.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { adjustLoyaltyBalance } from '@/lib/crm/loyalty'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { crm_customer_id, delta, reason }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'adjust_loyalty')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { crm_customer_id, delta, reason } = await req.json()
  if (!crm_customer_id || !delta || !reason?.trim()) return NextResponse.json({ error: 'crm_customer_id, delta and reason are required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: customer } = await admin.from('crm_customers').select('id').eq('id', crm_customer_id).eq('business_id', ctx.businessId).maybeSingle()
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  try {
    const result = await adjustLoyaltyBalance(admin, ctx.businessId, crm_customer_id, Number(delta), reason.trim(), ctx.userId)
    await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.loyalty_adjusted', entityType: 'crm_customers', entityId: crm_customer_id, newValues: { delta, reason, new_balance: result?.new_balance } })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message?.includes('insufficient_balance') ? 'This would take the balance negative.' : 'Could not adjust balance.' }, { status: 400 })
  }
}
