// @ts-nocheck
// GET /api/command-centre/supplier-prices — K27/K28.
import { NextResponse } from 'next/server'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'
import { getSupplierPriceChanges, getCostIncreaseVsPriceFlags } from '@/lib/commandCentre/supplierPrices'

export async function GET() {
  const result = await resolveCommandCentreContext('view_finance_intelligence')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business } = result

  const [priceChanges, priceFlags] = await Promise.all([
    getSupplierPriceChanges(admin, business.id),
    getCostIncreaseVsPriceFlags(admin, business.id),
  ])
  return NextResponse.json({ price_changes: priceChanges, cost_increase_vs_unchanged_price: priceFlags })
}
