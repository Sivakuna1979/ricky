// @ts-nocheck
import { createAdminClient } from '@/lib/supabase/server'
import { ReceiptActions } from './ReceiptActions'

// Public receipt view — keyed by the order's UUID (unguessable), so it
// works without login: a customer can view/print/share their own receipt,
// and staff can pull one up from the Orders dashboard for any past sale.
export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const admin = await createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('*, order_items(*), vans(name, profile_image_url, businesses(name))')
    .eq('id', params.id)
    .maybeSingle()

  if (!order) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#888', fontFamily: 'sans-serif' }}>
        Receipt not found.
      </div>
    )
  }

  const items = order.order_items ?? []
  const van = order.vans
  const bizName = van?.businesses?.name
  const paymentLabel = { card_online: 'Card (online)', cash_at_van: 'Cash', card_at_van: 'Card' }[order.payment_method] ?? order.payment_method
  const change = order.cash_tendered != null ? Number(order.cash_tendered) - Number(order.total) : null

  return (
    <div className="receipt-page" style={{ minHeight: '100vh', background: '#f5f6fa', padding: '24px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .receipt-card { box-shadow: none !important; border: none !important; max-width: 320px !important; margin: 0 auto !important; }
        }
      `}</style>
      <div className="receipt-card" style={{ maxWidth: 380, margin: '0 auto', background: '#fff', borderRadius: 14, padding: '28px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          {van?.profile_image_url && <img src={van.profile_image_url} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', marginBottom: 8 }} />}
          <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>{bizName || van?.name || 'FoodTaxi'}</div>
          {van?.name && bizName && <div style={{ fontSize: 12, color: '#888' }}>{van.name}</div>}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 16, paddingBottom: 16, borderBottom: '1px dashed #e5e7eb' }}>
          Order #{(order.order_number ?? order.id.slice(0, 8)).toUpperCase()}
          <br />
          {new Date(order.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {order.guest_name && <><br />{order.guest_name}</>}
        </div>

        <div style={{ marginBottom: 16 }}>
          {items.map((it: any) => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0' }}>
              <span>{it.quantity}× {it.name}</span>
              <span>£{Number(it.item_total).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
            <span>Subtotal</span><span>£{Number(order.subtotal ?? order.total).toFixed(2)}</span>
          </div>
          {Number(order.vat_amount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
              <span>VAT</span><span>£{Number(order.vat_amount).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, margin: '6px 0' }}>
            <span>Total</span><span>£{Number(order.total).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
            <span>Paid by</span><span>{paymentLabel}</span>
          </div>
          {order.cash_tendered != null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
                <span>Cash received</span><span>£{Number(order.cash_tendered).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', fontWeight: 700 }}>
                <span>Change given</span><span>£{Math.max(0, change ?? 0).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 20 }}>Thank you! 🍟</div>
      </div>

      <div className="no-print" style={{ maxWidth: 380, margin: '16px auto 0' }}>
        <ReceiptActions orderId={order.id} existingEmail={order.guest_email ?? ''} />
      </div>
    </div>
  )
}
