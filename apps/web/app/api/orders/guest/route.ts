// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { validateDiscountCode, claimDiscountCode } from '@/lib/crm/discounts'
import { findOrCreateCrmCustomer } from '@/lib/crm/identity'
import { round2 } from '@/lib/finance/money'
import { getAuthedUserProfile, getOrCreateCustomerRecord } from '@/lib/customer/identity'
import { rateLimitResponse } from '@/lib/rateLimit'

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

async function sbPostWith(key: string, table: string, body: any) {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(Array.isArray(data) ? data[0]?.message : (data.message ?? JSON.stringify(data)))
    err.status = res.status
    throw err
  }
  return Array.isArray(data) ? data[0] : data
}

async function sbGet(path: string) {
  const key = SERVICE_KEY() || ANON_KEY()
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  return res.ok ? res.json() : null
}

// Best-effort WhatsApp ping to the business owner about a new order.
// Works free whenever the owner has messaged the FoodTaxi number in the
// last 24h; otherwise Meta rejects it and we just skip silently.
async function notifyOwner(van_id: string, order_number: string, total: number, name: string) {
  try {
    const vans = await sbGet(`vans?id=eq.${van_id}&select=business_id`)
    const bizId = vans?.[0]?.business_id
    if (!bizId) return
    const bizs = await sbGet(`businesses?id=eq.${bizId}&select=phone`)
    const phone = bizs?.[0]?.phone
    if (!phone) return
    const channels = await sbGet(`whatsapp_channels?is_active=eq.true&select=phone_number_id,access_token,is_shared&order=is_shared.desc&limit=1`)
    const ch = channels?.[0]
    if (!ch) return
    const to = String(phone).replace(/[^\d]/g, '').replace(/^0/, '44')
    await fetch(`https://graph.facebook.com/v21.0/${ch.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ch.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'text',
        text: { body: `🔔 New FoodTaxi order #${order_number} — £${Number(total).toFixed(2)}${name ? ` from ${name}` : ''}. Open your dashboard: https://food-taxi.vercel.app/dashboard/orders` },
      }),
    }).catch(() => {})
  } catch {}
}

// Try the service key first (bypasses RLS); if it's missing or invalid,
// fall back to the anon key (works via the orders_guest_insert policy).
async function sbPost(table: string, body: any) {
  const svc = SERVICE_KEY()
  if (svc && svc !== ANON_KEY()) {
    try {
      return await sbPostWith(svc, table, body)
    } catch (e: any) {
      if (e.status !== 401 && e.status !== 403) throw e
    }
  }
  return sbPostWith(ANON_KEY(), table, body)
}

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse('orders-guest', req, 20, 60000)
  if (limited) return limited
  try {
    const { van_id, business_id, customer_name, customer_phone, customer_email, notes, pickup_location, pickup_time, pickup_stop_id, service_date, items, subtotal, total, payment_method, discount_code, referral_code } = await req.json()

    if (!customer_name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!customer_phone) return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    if (!items?.length) return NextResponse.json({ error: 'No items in order' }, { status: 400 })

    let admin: any = await createAdminClient()

    // J58/J59 — conservative, self-contained abuse guard: no dedicated
    // rate-limiting infrastructure exists in this codebase (documented as
    // a Phase K recommendation), but a runaway bot/retry loop placing many
    // orders in seconds for the same phone+van is caught here without one.
    // Deliberately generous (5 in 2 minutes) so it never blocks a genuine
    // customer correcting a mistake or a busy van's real repeat trade.
    if (van_id) {
      const twoMinAgo = new Date(Date.now() - 2 * 60000).toISOString()
      const { count: recentCount } = await admin
        .from('orders').select('id', { count: 'exact', head: true })
        .eq('van_id', van_id).eq('guest_phone', customer_phone).gte('created_at', twoMinAgo)
      if ((recentCount ?? 0) >= 5) {
        return NextResponse.json({ error: 'Too many orders placed in a short time — please wait a moment and try again.' }, { status: 429 })
      }

      // J20/J29/J67 — "ordering open/closed" was previously never actually
      // enforced anywhere on this route (a pre-existing gap found during
      // the Phase J audit: toggling accepts_online_orders had no real
      // effect on guest checkout). Now authoritative here, not just shown
      // as a badge on the van page.
      const { data: vanRow } = await admin.from('vans').select('accepts_online_orders, is_active').eq('id', van_id).maybeSingle()
      if (!vanRow || !vanRow.is_active) {
        return NextResponse.json({ error: 'This van is not currently available for online ordering.' }, { status: 409 })
      }
      if (vanRow.accepts_online_orders === false) {
        return NextResponse.json({ error: 'Online ordering is currently closed for this van — please check back later, or order via WhatsApp/in person if available.' }, { status: 409 })
      }
    }

    // J20/J71 — server-side availability + price revalidation, closing a
    // gap found during the Phase J audit: this route previously trusted
    // the client's cart entirely for both, with no re-check at all. The
    // server is now always authoritative — a stale page (or a reorder
    // from an older order) can never place an order at an out-of-date
    // price or for an item that's since sold out; it gets a clear
    // correction response instead (J20's "clear correction flow"). The
    // subtotal used for the rest of this request is also recomputed from
    // these server-confirmed prices, not trusted from the client.
    let serverSubtotal = subtotal ?? 0
    {
      const itemIds = [...new Set((items ?? []).map((i: any) => i.menu_item_id).filter(Boolean))]
      if (itemIds.length) {
        const { data: currentItems } = await admin.from('menu_items').select('id, price, available').in('id', itemIds)
        const byId = Object.fromEntries((currentItems ?? []).map((i: any) => [i.id, i]))
        const correction: any[] = []
        let recomputed = 0
        for (const it of items) {
          if (!it.menu_item_id) { recomputed += Number(it.item_total ?? it.price * it.quantity ?? 0); continue }
          const cur = byId[it.menu_item_id]
          if (!cur || cur.available === false) correction.push({ menu_item_id: it.menu_item_id, name: it.name, reason: 'unavailable' })
          else if (Number(cur.price) !== Number(it.price)) correction.push({ menu_item_id: it.menu_item_id, name: it.name, reason: 'price_changed', current_price: cur.price })
          else recomputed += Number(cur.price) * Number(it.quantity ?? 1)
        }
        if (correction.length) {
          return NextResponse.json({ error: 'Some items in your order have changed — please review and try again.', correction }, { status: 409 })
        }
        serverSubtotal = round2(recomputed)
      }
    }

    // Phase I — a promo/voucher code, always revalidated and priced
    // server-side here, never trusted from the client (I18/I21). Starts
    // from serverSubtotal (Phase J — server-recomputed from current menu
    // prices, see above), not the client's own total.
    let resolvedCode: any = null
    let finalTotal = serverSubtotal
    let finalDiscountAmount = 0
    let crmCustomerForCode: any = null
    let resolvedBusinessId = business_id ?? null
    if (discount_code) {
      if (!resolvedBusinessId && van_id) {
        const { data: van } = await admin.from('vans').select('business_id').eq('id', van_id).maybeSingle()
        resolvedBusinessId = van?.business_id ?? null
      }
      if (resolvedBusinessId) {
        crmCustomerForCode = await findOrCreateCrmCustomer(admin, resolvedBusinessId, { phone: customer_phone, email: customer_email, displayName: customer_name })
        resolvedCode = await validateDiscountCode(admin, resolvedBusinessId, discount_code, {
          vanId: van_id, channel: 'guest', subtotal: serverSubtotal, crmCustomerId: crmCustomerForCode?.id ?? null, isNewCustomer: false, // conservative default — see docs "Not built"
        })
        if (!resolvedCode.valid) return NextResponse.json({ error: `Code not valid: ${resolvedCode.reason}` }, { status: 400 })
        finalDiscountAmount = resolvedCode.discount_amount
        finalTotal = round2(Math.max(0, serverSubtotal - finalDiscountAmount))
      }
    }

    // Phase J8 — if the browser placing this "guest" order actually has a
    // signed-in customer session, attach it to the order directly so it
    // shows up in their order history immediately (no reliance on a later
    // email-match claim). Best-effort and silent on failure — a signed-in
    // customer must never be blocked from ordering as a guest would be.
    let linkedCustomerId: string | null = null
    try {
      const supabase = await createClient()
      const profile = await getAuthedUserProfile(supabase)
      if (profile) {
        const customer = await getOrCreateCustomerRecord(admin, profile.userId)
        linkedCustomerId = customer?.id ?? null
      }
    } catch { /* guest checkout must never fail because of this */ }

    // Phase G — never trust a stop id without checking it actually
    // belongs to this van's own schedule.
    let verifiedStopId: string | null = null
    if (pickup_stop_id && van_id) {
      const stops = await sbGet(`van_schedule?id=eq.${pickup_stop_id}&van_id=eq.${van_id}&select=id`)
      verifiedStopId = stops?.[0]?.id ?? null
    }
    // service_date: trust the client's chosen pickup day only if it's a
    // plausible near-future date (matches the 7-day picker window with a
    // little margin) — otherwise fall back to today rather than storing
    // an arbitrary client-supplied date.
    const todayIso = new Date().toISOString().slice(0, 10)
    const maxIso = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10)
    const resolvedServiceDate = typeof service_date === 'string' && service_date >= todayIso && service_date <= maxIso
      ? service_date : todayIso

    // Try with guest columns first, fall back to notes-only.
    // order_number is left unset so the DB trigger fills it in (daily-reset
    // sequence) — do not generate one client-side.
    let order: any = null
    try {
      order = await sbPost('orders', {
        van_id: van_id || null,
        customer_id: linkedCustomerId,
        guest_name: customer_name,
        guest_phone: customer_phone,
        notes: notes || null,
        pickup_location: pickup_location || null,
        pickup_time: pickup_time || null,
        pickup_stop_id: verifiedStopId,
        service_date: resolvedServiceDate,
        subtotal: serverSubtotal,
        total: finalTotal,
        discount_amount: finalDiscountAmount || undefined,
        discount_code: resolvedCode ? String(discount_code).trim().toUpperCase() : undefined,
        referral_code_used: referral_code ? String(referral_code).trim().toUpperCase() : undefined,
        payment_method: payment_method ?? 'cash_at_van',
        status: 'pending',
        source: 'guest',
      })
    } catch {
      const pickupStr = pickup_location ? ` | Pickup: ${pickup_location}${pickup_time ? ` ~${pickup_time}` : ''}` : ''
      order = await sbPost('orders', {
        van_id: van_id || null,
        customer_id: linkedCustomerId,
        notes: `Order from ${customer_name} (${customer_phone})${notes ? '. ' + notes : ''}${pickupStr}`,
        subtotal: serverSubtotal,
        total: finalTotal,
        payment_method: payment_method ?? 'cash_at_van',
        status: 'pending',
        source: 'guest',
      })
    }
    const order_number = order?.order_number

    if (resolvedCode?.valid && admin && order?.id) {
      try { await claimDiscountCode(admin, resolvedBusinessId, resolvedCode, order.id, crmCustomerForCode?.id ?? null) } catch (_e) {}
    }

    if (order?.id && items.length > 0) {
      await sbPost('order_items', items.map((i: any) => ({
        order_id: order.id,
        menu_item_id: i.menu_item_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        item_total: i.item_total,
      }))).catch(() => {})
    }

    if (van_id) await notifyOwner(van_id, order_number, total ?? 0, customer_name)

    return NextResponse.json({ order_number, id: order?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed' }, { status: 500 })
  }
}
