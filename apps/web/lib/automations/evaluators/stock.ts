// @ts-nocheck
// D8, D9, D10 — stock threshold alerts and the optional draft-PO
// automation. Runs once per business per day (trigger_key includes the
// business-local date), so a stock item that stays low doesn't re-alert on
// every cron tick — see docs for the chosen "scheduled evaluation, not
// live event hook" design.
import { claimRun, completeRun, notify } from '../engine'
import { getResolvedSettings } from '../settings'
import { getRecipients } from '../recipients'
import { todayDateInTimezone } from '../timezone'

export async function runStockAutomations(admin: any, business: { id: string; timezone: string; name: string }) {
  const date = todayDateInTimezone(business.timezone)
  const settings = await getResolvedSettings(admin, business.id)

  const { data: items } = await admin.from('stock_items').select('id, name, unit, minimum_quantity, reorder_quantity, supplier_id, active').eq('business_id', business.id).eq('active', true)
  if (!items?.length) return

  const { data: levels } = await admin.from('stock_levels').select('stock_item_id, quantity').in('stock_item_id', items.map((i: any) => i.id))
  const totals: Record<string, number> = {}
  for (const l of levels ?? []) totals[l.stock_item_id] = (totals[l.stock_item_id] ?? 0) + (l.quantity ?? 0)

  const low = items.filter((i: any) => { const q = totals[i.id] ?? 0; return q > 0 && q <= i.minimum_quantity })
  const out = items.filter((i: any) => (totals[i.id] ?? 0) <= 0)

  if (settings.low_stock.enabled) {
    for (const item of low) {
      const runId = await claimRun(admin, business.id, 'low_stock', `low_stock:${item.id}:${date}`)
      if (!runId) continue
      const recipients = await getRecipients(admin, business.id, 'manage_stock')
      const qty = totals[item.id] ?? 0
      const suggestion = item.reorder_quantity
        ? ` Suggested reorder: ${item.reorder_quantity} ${item.unit} (based on your configured reorder quantity).`
        : ''
      const result = await notify(admin, {
        businessId: business.id, automationType: 'low_stock', recipients,
        title: `⚠️ Low stock — ${item.name}`,
        body: `${item.name} is at ${qty} ${item.unit} (minimum ${item.minimum_quantity}).${suggestion}`,
        category: 'stock', priority: 'ACTION', actionUrl: '/dashboard/stock',
      })
      await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
    }
  }

  if (settings.out_of_stock.enabled) {
    for (const item of out) {
      const runId = await claimRun(admin, business.id, 'out_of_stock', `out_of_stock:${item.id}:${date}`)
      if (!runId) continue
      const recipients = await getRecipients(admin, business.id, 'manage_stock')
      const result = await notify(admin, {
        businessId: business.id, automationType: 'out_of_stock', recipients,
        title: `❌ Out of stock — ${item.name}`,
        body: `${item.name} has run out.`,
        category: 'stock', priority: 'IMPORTANT', actionUrl: '/dashboard/stock',
      })
      await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'notified', result })
    }
  }

  // D10 — draft PO, off by default, never auto-sends to a supplier.
  if (settings.draft_po_on_low_stock.enabled) {
    const needsReorder = [...out, ...low].filter((i: any) => i.supplier_id && i.reorder_quantity)
    const bySupplier: Record<string, any[]> = {}
    for (const i of needsReorder) (bySupplier[i.supplier_id] ??= []).push(i)

    for (const [supplierId, supplierItems] of Object.entries(bySupplier)) {
      const runId = await claimRun(admin, business.id, 'draft_po_on_low_stock', `draft_po:${business.id}:${supplierId}:${date}`)
      if (!runId) continue
      try {
        const { data: po, error } = await admin.from('purchase_orders').insert({
          business_id: business.id, supplier_id: supplierId, status: 'DRAFT',
          notes: 'Automatically drafted from low/out-of-stock alerts — review and confirm before ordering.',
        }).select().single()
        if (error) throw error
        await admin.from('purchase_order_items').insert(
          supplierItems.map((i: any) => ({ purchase_order_id: po.id, stock_item_id: i.id, quantity_ordered: i.reorder_quantity }))
        )
        const recipients = await getRecipients(admin, business.id, 'manage_purchase_orders')
        const result = await notify(admin, {
          businessId: business.id, automationType: 'draft_po_on_low_stock', recipients,
          title: '📦 Draft purchase order created',
          body: `A draft purchase order for ${supplierItems.length} low-stock item${supplierItems.length === 1 ? '' : 's'} is ready for your review.`,
          category: 'stock', priority: 'ACTION', actionUrl: '/dashboard/suppliers',
        })
        await completeRun(admin, runId, { status: 'COMPLETED', actionTaken: 'draft_po_created', result: { purchase_order_id: po.id, ...result } })
      } catch (e: any) {
        await completeRun(admin, runId, { status: 'FAILED', failureReason: e.message ?? 'unknown_error' })
      }
    }
  }
}
