// @ts-nocheck
// Automatic stock deduction (C8). Deliberately optional per business: if a
// business hasn't linked any menu_stock_components, or hasn't set up a
// stock_location for the van, this silently does nothing — it must never
// block an order from being fulfilled.
//
// Deduction point: order status → 'collected'. Not order creation (an
// order can be cancelled before collection with nothing ever having left
// the van) and not payment (POS cash sales have no separate payment event,
// and 'collected' is the one status every channel — online, POS, WhatsApp
// — passes through via the single PATCH /api/orders/[id]/status route).
//
// Idempotency: orders.stock_deducted_at / stock_restored_at are
// compare-and-set guards. A retried webhook, a repeated offline-POS sync,
// or the same status change firing twice all hit the `IS NULL` guard on
// the UPDATE and no-op on the second attempt — this is safe under
// concurrent retries because the guard is enforced by the UPDATE's WHERE
// clause at the database level, not by an application-level check-then-act
// (which would have a race window).
//
// Restoration policy (cancellation after deduction): a RETURN movement puts
// back exactly what SALE took out, only if stock_deducted_at is set and
// stock_restored_at is not — so a cancel-after-cancel or a cancel that
// never actually deducted anything is a safe no-op.
export async function deductStockForOrder(admin: any, orderId: string, userId?: string | null) {
  const { data: claimed } = await admin
    .from('orders').update({ stock_deducted_at: new Date().toISOString() })
    .eq('id', orderId).is('stock_deducted_at', null)
    .select('id, van_id, business_id').maybeSingle()
  if (!claimed) return // already deducted (or order not found) — nothing to do

  await applyOrderStockDelta(admin, claimed, orderId, userId, 'SALE', -1)
}

export async function restoreStockForOrder(admin: any, orderId: string, userId?: string | null) {
  const { data: claimed } = await admin
    .from('orders').update({ stock_restored_at: new Date().toISOString() })
    .eq('id', orderId).not('stock_deducted_at', 'is', null).is('stock_restored_at', null)
    .select('id, van_id, business_id').maybeSingle()
  if (!claimed) return // never deducted, or already restored — nothing to do

  await applyOrderStockDelta(admin, claimed, orderId, userId, 'RETURN', 1)
}

async function applyOrderStockDelta(admin: any, order: any, orderId: string, userId: string | null | undefined, movementType: 'SALE' | 'RETURN', sign: 1 | -1) {
  const { data: business } = await admin.from('vans').select('business_id').eq('id', order.van_id).maybeSingle()
  const businessId = business?.business_id
  if (!businessId) return

  const { data: location } = await admin
    .from('stock_locations').select('id').eq('van_id', order.van_id).maybeSingle()
  if (!location) return // business hasn't set up a stock location for this van — nothing to deduct against

  const { data: items } = await admin
    .from('order_items').select('menu_item_id, quantity').eq('order_id', orderId)
  if (!items?.length) return

  for (const item of items) {
    if (!item.menu_item_id) continue
    const { data: components } = await admin
      .from('menu_stock_components').select('stock_item_id, quantity_per_item').eq('menu_item_id', item.menu_item_id)
    if (!components?.length) continue // this menu item has no configured recipe — nothing to deduct

    for (const c of components) {
      const delta = sign * c.quantity_per_item * (item.quantity ?? 1)
      await admin.rpc('apply_stock_movement', {
        p_business_id: businessId,
        p_stock_item_id: c.stock_item_id,
        p_location_id: location.id,
        p_movement_type: movementType,
        p_delta: delta,
        p_user_id: userId ?? null,
        p_reference_type: 'order',
        p_reference_id: orderId,
      })
    }
  }
}
