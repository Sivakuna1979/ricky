import { createClient } from '@supabase/supabase-js'
import { evaluateAlert, type AlertKind } from '@/lib/alerts/rules'
import { getUniverse } from '@/lib/screener/universe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Scheduled alert evaluation (e.g. Vercel cron, hourly). Evaluates price,
 * valuation and score rules for all users with the service role, and records
 * last_fired_at (at most once per 24h per alert). Delivery (email/push) plugs in
 * where noted. Protected by CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return Response.json({ status: 'skipped', reason: 'Supabase service role not configured' })

  const sb = createClient(url, key, { auth: { persistSession: false } })
  const { data: alerts, error } = await sb.from('alerts').select('id,user_id,ticker,kind,params,last_fired_at').eq('active', true).limit(5000)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const universe = getUniverse()
  const dayAgo = Date.now() - 86_400_000
  const fired: { id: string; user_id: string; ticker: string; detail: string }[] = []
  let awaitingFeed = 0
  for (const a of alerts ?? []) {
    const row = universe.find((u) => u.ticker === a.ticker)
    const status = evaluateAlert({ id: a.id, ticker: a.ticker, kind: a.kind as AlertKind, value: a.params?.value, active: true }, { price: row?.price, pe: row?.pe, score: row?.scores.overall })
    if (status.state === 'awaiting_feed') awaitingFeed++
    if (status.state !== 'triggered') continue
    if (a.last_fired_at && new Date(a.last_fired_at).getTime() > dayAgo) continue
    fired.push({ id: a.id, user_id: a.user_id, ticker: a.ticker, detail: status.detail })
  }
  if (fired.length) await sb.from('alerts').update({ last_fired_at: new Date().toISOString() }).in('id', fired.map((f) => f.id))
  // Delivery hook: send `fired` via your email/push provider here (e.g. Resend) — not configured in v1.
  return Response.json({ status: 'ok', evaluated: alerts?.length ?? 0, fired: fired.length, awaitingFeed })
}
