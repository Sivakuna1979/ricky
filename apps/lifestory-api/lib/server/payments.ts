import { adminClient } from './supabase'
import { HttpError } from './http'

/**
 * Each film is a one-off in-app purchase (Apple and Google require in-app purchase for digital
 * goods). RevenueCat handles both stores; the app logs in to RevenueCat with the Supabase user id,
 * so here we ask RevenueCat for that user's purchases and claim one that hasn't paid for a film yet.
 */
const PRODUCTS = (process.env.FILM_PRODUCT_IDS ?? 'lifestory_film,lifestory_film_premium').split(',').map((s) => s.trim())

export async function claimPurchase(userId: string, filmId: string): Promise<string> {
  if (process.env.LIFESTORY_FREE_RENDERS === 'true') return `free-${filmId}`
  const key = process.env.REVENUECAT_SECRET_KEY
  if (!key) throw new HttpError(503, 'Payments are not set up yet.')

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new HttpError(502, 'Could not check your purchase. Please try again.')
  const body = (await res.json()) as { subscriber?: { non_subscriptions?: Record<string, { id: string; store_transaction_id?: string }[]> } }
  const purchases = PRODUCTS.flatMap((p) => body.subscriber?.non_subscriptions?.[p] ?? []).map((t) => t.store_transaction_id ?? t.id)
  if (!purchases.length) throw new HttpError(402, 'Payment not found. Please complete the purchase first.')

  const { data: used } = await adminClient().from('ls_films').select('purchase_id').eq('user_id', userId).in('purchase_id', purchases)
  const usedIds = new Set((used ?? []).map((r) => r.purchase_id))
  const free = purchases.find((id) => !usedIds.has(id))
  if (!free) throw new HttpError(402, 'Each purchase makes one film. Please buy another film to continue.')
  return free
}
