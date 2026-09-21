// @ts-nocheck
// GET /api/command-centre/search?q=... — K51. A fast, deterministic
// multi-entity lookup across everything an owner might want to jump to —
// never customer PII beyond a name already visible elsewhere in the app.
// Not full-text search infrastructure (no new indexes) — plain, bounded
// ILIKE queries are more than adequate at a single business's data volume.
// Deliberately excludes event_requests/applications (K51's "events"): that
// table has no business_id column at all (it's the cross-business
// marketplace table — see lib/commandCentre/tomorrow.ts's own comment on
// how a business's events are matched via owner email), so a safe,
// correctly-scoped search over it needs more than a plain ILIKE and was
// left out rather than risk a cross-tenant leak in a search endpoint.
import { NextRequest, NextResponse } from 'next/server'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'

const LIMIT = 5

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const result = await resolveCommandCentreContext('view_command_centre')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, effectiveVanIds } = result
  const like = `%${q}%`

  const [vans, stops, stock, suppliers, staff, vehicles, equipment, memory] = await Promise.all([
    admin.from('vans').select('id, name, slug').eq('business_id', business.id).in('id', effectiveVanIds).ilike('name', like).limit(LIMIT),
    admin.from('van_schedule').select('id, van_id, location_name').in('van_id', effectiveVanIds).ilike('location_name', like).limit(LIMIT),
    admin.from('stock_items').select('id, name').eq('business_id', business.id).ilike('name', like).limit(LIMIT),
    admin.from('supplier_records').select('id, name').eq('business_id', business.id).ilike('name', like).limit(LIMIT),
    admin.from('staff').select('id, users!inner(full_name)').eq('business_id', business.id).ilike('users.full_name', like).limit(LIMIT),
    admin.from('vehicle_details').select('van_id, vans!inner(name)').eq('business_id', business.id).in('van_id', effectiveVanIds).ilike('vans.name', like).limit(LIMIT),
    admin.from('equipment').select('id, name').eq('business_id', business.id).ilike('name', like).limit(LIMIT),
    admin.from('business_memory').select('id, category, content').eq('business_id', business.id).ilike('content', like).limit(LIMIT),
  ])

  const results = [
    ...(vans.data ?? []).map((v: any) => ({ type: 'van', label: v.name, url: `/van/${v.slug}` })),
    ...(stops.data ?? []).map((s: any) => ({ type: 'stop', label: s.location_name, url: '/dashboard/schedule' })),
    ...(stock.data ?? []).map((s: any) => ({ type: 'stock item', label: s.name, url: '/dashboard/stock' })),
    ...(suppliers.data ?? []).map((s: any) => ({ type: 'supplier', label: s.name, url: '/dashboard/suppliers' })),
    ...(staff.data ?? []).map((s: any) => ({ type: 'staff', label: s.users?.full_name, url: '/dashboard/team' })).filter((r: any) => r.label),
    ...(vehicles.data ?? []).map((v: any) => ({ type: 'vehicle', label: v.vans?.name, url: '/dashboard/fleet' })).filter((r: any) => r.label),
    ...(equipment.data ?? []).map((e: any) => ({ type: 'equipment', label: e.name, url: '/dashboard/fleet' })),
    ...(memory.data ?? []).map((m: any) => ({ type: 'memory note', label: m.content?.slice(0, 80), url: '/dashboard/memory' })),
  ]

  return NextResponse.json({ results: results.slice(0, 40) })
}
