// @ts-nocheck
// Operations dashboard (C27) — pulls the highest-value alerts from across
// Phase C plus existing hygiene data into one summary. Read-only,
// server-aggregated (no full history sent to the browser).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'

const REMINDER_WINDOW_DAYS = 30

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const businessId = ctx.businessId
  const today = new Date().toISOString().split('T')[0]
  const todayStart = `${today}T00:00:00`
  const soonCutoff = new Date(Date.now() + REMINDER_WINDOW_DAYS * 86400000).toISOString().split('T')[0]

  const [{ data: items }, { data: levels }, { data: wastageToday }, { data: pos }, { data: shiftsToday }, { data: vehicles }, { data: vans }] = await Promise.all([
    supabase.from('stock_items').select('id, minimum_quantity').eq('business_id', businessId).eq('active', true),
    supabase.from('stock_levels').select('stock_item_id, quantity'),
    supabase.from('wastage_records').select('cost').eq('business_id', businessId).gte('created_at', todayStart),
    supabase.from('purchase_orders').select('id, status').eq('business_id', businessId).in('status', ['ORDERED', 'PARTIALLY_RECEIVED']),
    supabase.from('shifts').select('staff_id').eq('business_id', businessId).eq('shift_date', today),
    supabase.from('vehicle_details').select('van_id, mot_expiry, insurance_expiry, tax_expiry, service_due_date').eq('business_id', businessId),
    supabase.from('vans').select('id, name, is_active').eq('business_id', businessId).eq('is_active', true),
  ])

  const totalsByItem: Record<string, number> = {}
  for (const l of levels ?? []) totalsByItem[l.stock_item_id] = (totalsByItem[l.stock_item_id] ?? 0) + (l.quantity ?? 0)
  const itemsWithQty = (items ?? []).map(i => ({ ...i, qty: totalsByItem[i.id] ?? 0 }))
  const lowStock = itemsWithQty.filter(i => i.qty > 0 && i.qty <= i.minimum_quantity).length
  const outOfStock = itemsWithQty.filter(i => i.qty <= 0).length

  const wastageTodayCost = Math.round((wastageToday ?? []).reduce((s, w) => s + (w.cost ?? 0), 0) * 100) / 100

  const vanIds = (vans ?? []).map(v => v.id)
  const { data: checklistsToday } = vanIds.length
    ? await supabase.from('hygiene_logs').select('van_id').eq('log_type', 'opening_checklist').gte('recorded_at', todayStart).in('van_id', vanIds)
    : { data: [] }
  const vansWithChecklist = new Set((checklistsToday ?? []).map(c => c.van_id))
  const hygieneOutstanding = vanIds.filter(id => !vansWithChecklist.has(id)).length

  const vehicleAlerts: { van_id: string; field: string; date: string }[] = []
  for (const v of vehicles ?? []) {
    for (const field of ['mot_expiry', 'insurance_expiry', 'tax_expiry', 'service_due_date']) {
      const date = v[field]
      if (date && date <= soonCutoff) vehicleAlerts.push({ van_id: v.van_id, field, date })
    }
  }

  return NextResponse.json({
    low_stock: lowStock,
    out_of_stock: outOfStock,
    wastage_today: wastageTodayCost,
    purchase_orders_awaiting: (pos ?? []).length,
    staff_working_today: new Set((shiftsToday ?? []).map(s => s.staff_id)).size,
    vehicle_alerts: vehicleAlerts.length,
    vehicle_alert_details: vehicleAlerts,
    hygiene_outstanding: hygieneOutstanding,
  })
}
