// @ts-nocheck
// GET /api/command-centre/price-simulator — K31. Pure calculation, no
// persistence — never writes to menu_items (prices are only ever changed
// through the existing Menu management flow).
import { NextRequest, NextResponse } from 'next/server'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'
import { simulatePriceChange } from '@/lib/commandCentre/supplierPrices'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const menuItemId = searchParams.get('menu_item_id')
  const proposedPrice = Number(searchParams.get('proposed_price'))
  if (!menuItemId || !Number.isFinite(proposedPrice)) return NextResponse.json({ error: 'menu_item_id and proposed_price required' }, { status: 400 })

  const result = await resolveCommandCentreContext('view_finance_intelligence')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, effectiveVanIds } = result

  const { data: item } = await admin.from('menu_items').select('id, name, price, van_id, vans!inner(business_id)').eq('id', menuItemId).eq('vans.business_id', business.id).maybeSingle()
  if (!item || !effectiveVanIds.includes(item.van_id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: components } = await admin.from('menu_stock_components').select('quantity_per_item, stock_items(cost_price)').eq('menu_item_id', menuItemId)
  let knownCost: number | null = 0
  for (const c of components ?? []) {
    if (c.stock_items?.cost_price == null) { knownCost = null; break }
    knownCost += c.stock_items.cost_price * (c.quantity_per_item ?? 0)
  }

  return NextResponse.json({ menu_item_id: item.id, name: item.name, ...simulatePriceChange(item.price, proposedPrice, knownCost) })
}
