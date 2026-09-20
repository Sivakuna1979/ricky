// @ts-nocheck
// I45–I48 — feedback/reviews. Factual metrics only (I48) — no
// interpretation of a small sample beyond showing the actual count
// alongside the average, so a reader can judge reliability themselves.
export async function getReviewSummary(admin: any, businessId: string, vanId?: string) {
  let query = admin.from('reviews').select('rating, created_at, is_published').eq('business_id', businessId)
  if (vanId) query = query.eq('van_id', vanId)
  const { data } = await query
  const rows = data ?? []
  const count = rows.length
  const average = count ? Math.round((rows.reduce((s: number, r: any) => s + r.rating, 0) / count) * 100) / 100 : null

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of rows) distribution[r.rating] = (distribution[r.rating] ?? 0) + 1

  const byMonth: Record<string, { sum: number; count: number }> = {}
  for (const r of rows) {
    const month = r.created_at.slice(0, 7)
    byMonth[month] ??= { sum: 0, count: 0 }
    byMonth[month].sum += r.rating; byMonth[month].count += 1
  }
  const trend = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, average: Math.round((v.sum / v.count) * 100) / 100, count: v.count }))

  return { review_count: count, average_rating: average, distribution, trend, published_count: rows.filter((r: any) => r.is_published).length }
}

// I45 — idempotent: a feedback request is recorded (and only ever
// recorded) once per order, so a retried automation run can never ask
// the same customer twice for the same order.
export async function markFeedbackRequested(admin: any, businessId: string, orderId: string) {
  const { data, error } = await admin.from('feedback_requests').insert({ business_id: businessId, order_id: orderId }).select().maybeSingle()
  if (error?.code === '23505') return null // already requested
  return data
}
