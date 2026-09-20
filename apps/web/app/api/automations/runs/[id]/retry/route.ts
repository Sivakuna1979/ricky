// @ts-nocheck
// Manual retry for a FAILED automation run (D31). Re-invokes that
// automation family for the same business — claimRun() only reclaims the
// specific FAILED trigger_key (see lib/automations/engine.ts), so already
// COMPLETED sibling items are untouched and this can't duplicate anything.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { runStockAutomations } from '@/lib/automations/evaluators/stock'
import { runHygieneAutomations } from '@/lib/automations/evaluators/hygiene'
import { runVehicleAutomations } from '@/lib/automations/evaluators/vehicle'
import { runStaffAutomations } from '@/lib/automations/evaluators/staff'
import { runDailyBriefing, runEndOfDaySummary, runWeeklySummary } from '@/lib/automations/evaluators/reports'
import { runMarketingSuggestions } from '@/lib/automations/evaluators/marketing'
import { runEventTomorrowReminders } from '@/lib/automations/evaluators/events'

const DISPATCH: Record<string, (admin: any, business: any) => Promise<void>> = {
  low_stock: runStockAutomations, out_of_stock: runStockAutomations, draft_po_on_low_stock: runStockAutomations,
  hygiene_missed: runHygieneAutomations,
  vehicle_reminder: runVehicleAutomations, equipment_reminder: runVehicleAutomations,
  staff_unassigned_shift: runStaffAutomations, staff_late_clockin: runStaffAutomations, staff_missing_clockout: runStaffAutomations,
  daily_briefing: runDailyBriefing, end_of_day_summary: runEndOfDaySummary, weekly_summary: runWeeklySummary,
  marketing_suggestion: runMarketingSuggestions,
  event_tomorrow: async (admin: any) => { await runEventTomorrowReminders(admin) },
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_business')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: run } = await admin.from('automation_runs').select('*').eq('id', params.id).maybeSingle()
  if (!run || run.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (run.status !== 'FAILED') return NextResponse.json({ error: 'Only a failed run can be retried' }, { status: 409 })

  const evaluator = DISPATCH[run.automation_type]
  if (!evaluator) return NextResponse.json({ error: 'Unknown automation type' }, { status: 400 })

  const { data: business } = await admin.from('businesses').select('id, name, timezone').eq('id', ctx.businessId).maybeSingle()
  await evaluator(admin, business)

  const { data: refreshed } = await admin.from('automation_runs').select('*').eq('id', params.id).maybeSingle()
  return NextResponse.json(refreshed)
}
