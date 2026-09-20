// @ts-nocheck
// H14 — PO vs goods-received vs invoice review. Reuses Phase C's
// purchase_order_items (quantity_ordered/quantity_received/unit_cost)
// exactly as they are — no new "goods received" table. Invoice matching
// is at the header (total) level (see the migration's supplier_invoices
// comment for why no per-line invoice items table was introduced) — this
// flags a mismatch for a human to look at, it never auto-corrects
// anything (H54).
import { round2 } from './money'

export async function getPoInvoiceMatch(admin: any, businessId: string, purchaseOrderId: string) {
  const { data: po } = await admin.from('purchase_orders').select('id, business_id, status, supplier_id').eq('id', purchaseOrderId).maybeSingle()
  if (!po || po.business_id !== businessId) return { found: false }

  const { data: items } = await admin.from('purchase_order_items').select('quantity_ordered, quantity_received, unit_cost').eq('purchase_order_id', purchaseOrderId)
  const orderedTotal = round2((items ?? []).reduce((s: number, i: any) => s + (i.quantity_ordered ?? 0) * (i.unit_cost ?? 0), 0))
  const receivedTotal = round2((items ?? []).reduce((s: number, i: any) => s + (i.quantity_received ?? 0) * (i.unit_cost ?? 0), 0))
  const fullyReceived = (items ?? []).every((i: any) => (i.quantity_received ?? 0) >= (i.quantity_ordered ?? 0))

  const { data: invoices } = await admin.from('supplier_invoices').select('id, invoice_number, gross_amount, status').eq('purchase_order_id', purchaseOrderId).neq('status', 'VOID')
  const invoicedTotal = round2((invoices ?? []).reduce((s: number, i: any) => s + (i.gross_amount ?? 0), 0))

  const receivedVsInvoiced = round2(invoicedTotal - receivedTotal)
  const thresholdPct = 5 // a >5% difference is flagged — everything is still shown regardless
  const pctDiff = receivedTotal ? round2((receivedVsInvoiced / receivedTotal) * 100) : null
  const flagged = invoices?.length > 0 && (pctDiff === null || Math.abs(pctDiff) > thresholdPct)

  return {
    found: true, purchase_order_id: purchaseOrderId, fully_received: fullyReceived,
    ordered_total: orderedTotal, received_total: receivedTotal, invoiced_total: invoicedTotal,
    difference: receivedVsInvoiced, difference_pct: pctDiff, flagged,
    invoices: (invoices ?? []).map((i: any) => ({ id: i.id, invoice_number: i.invoice_number, gross_amount: i.gross_amount, status: i.status })),
  }
}
