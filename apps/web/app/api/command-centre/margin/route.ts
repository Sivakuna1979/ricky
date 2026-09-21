// @ts-nocheck
// GET /api/command-centre/margin — K29/K30.
import { NextRequest, NextResponse } from 'next/server'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'
import { getMenuMarginReview } from '@/lib/commandCentre/supplierPrices'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const vanId = searchParams.get('van_id')
  const result = await resolveCommandCentreContext('view_finance_intelligence', vanId)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, effectiveVanIds } = result

  const review = await getMenuMarginReview(admin, business.id, effectiveVanIds)
  return NextResponse.json(review)
}
