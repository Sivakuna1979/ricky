import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  const { type, order_id, van_id, status } = await req.json()

  if (type === 'new_order' && order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('*, customers(users(full_name)), vans(name, business_id, businesses(owner_id, users!businesses_owner_id_fkey(id)))')
      .eq('id', order_id)
      .single()

    if (!order) return new Response(JSON.stringify({ ok: false }), { status: 404 })

    const ownerUserId = (order.vans as any)?.businesses?.users?.id

    if (ownerUserId) {
      await supabase.from('notifications').insert({
        user_id: ownerUserId,
        title: 'New Order Received',
        body: `New order #${order.order_number} from ${(order.customers as any)?.users?.full_name}`,
        type: 'new_order',
        data: { order_id, van_id },
      })
    }
  }

  if (type === 'order_status_update' && order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('*, customers(user_id)')
      .eq('id', order_id)
      .single()

    if (order) {
      const customerUserId = (order.customers as any)?.user_id
      const statusMessages: Record<string, string> = {
        accepted: 'Your order has been accepted!',
        preparing: 'Your order is being prepared...',
        ready: 'Your order is ready to collect!',
        collected: 'Order complete. Enjoy your food!',
        cancelled: 'Your order has been cancelled.',
      }

      if (customerUserId && statusMessages[status]) {
        await supabase.from('notifications').insert({
          user_id: customerUserId,
          title: 'Order Update',
          body: statusMessages[status],
          type: 'order_status_update',
          data: { order_id, status },
        })
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
