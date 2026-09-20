// @ts-nocheck
// I4 — the CRM customer list. Contact fields (phone/email) are only
// included when the caller has view_customer_contact, not just
// view_customers (I4 — "do not expose unnecessary PII in list views").
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { listCrmCustomers } from '@/lib/crm/segments'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_customers')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const admin = await createAdminClient()
  const result = await listCrmCustomers(admin, ctx.businessId, {
    search: searchParams.get('search') ?? undefined,
    segment: searchParams.get('segment') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    pageSize: Number(searchParams.get('page_size') ?? 50),
    includeContact: hasPermission(ctx.role, 'view_customer_contact'),
  })
  return NextResponse.json(result)
}
