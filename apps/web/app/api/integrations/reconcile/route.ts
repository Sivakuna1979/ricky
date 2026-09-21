// @ts-nocheck
// L46 — manual "re-check reconciliation" trigger for the Integration
// Centre's own button, on top of the scheduled sweep (see
// lib/automations/evaluators/integrations.ts). Safe to call repeatedly —
// runReconciliationSweep dedupes review items itself.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { runReconciliationSweep } from '@/lib/payments/reconciliation'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const summary = await runReconciliationSweep(admin, ctx.businessId)
  return NextResponse.json(summary)
}
