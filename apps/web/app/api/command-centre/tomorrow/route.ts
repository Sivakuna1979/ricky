// @ts-nocheck
// GET /api/command-centre/tomorrow — K19/K20.
import { NextRequest, NextResponse } from 'next/server'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'
import { getTomorrowReadiness, getTomorrowBusinessContext } from '@/lib/commandCentre/tomorrow'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vanId = searchParams.get('van_id')
  const result = await resolveCommandCentreContext('view_command_centre', vanId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, allVans, effectiveVanIds } = result

  const scopedVans = allVans.filter((v: any) => effectiveVanIds.includes(v.id))
  const [perVan, businessContext] = await Promise.all([
    Promise.all(scopedVans.map((v: any) => getTomorrowReadiness(admin, business.id, v))),
    getTomorrowBusinessContext(admin, business.id),
  ])

  return NextResponse.json({ vans: perVan, ...businessContext })
}
