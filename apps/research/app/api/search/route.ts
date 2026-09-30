import { NextResponse } from 'next/server'
import { z } from 'zod'
import { searchCompanies } from '@/lib/data/dataset'
import { clientKey, rateLimit } from '@/lib/security/rate-limit'
import { getViewer, viewerKey } from '@/lib/auth/viewer'
import { LIMITS } from '@/lib/plans'

const Query = z.object({ q: z.string().trim().min(1).max(40) })

export async function GET(req: Request) {
  const rl = rateLimit(`search:${clientKey(req)}`, 120)
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const viewer = await getViewer()
  const daily = rateLimit(`search-day:${viewerKey(viewer, clientKey(req))}`, LIMITS[viewer.plan].searchesPerDay, 86_400_000)
  if (!daily.ok) return NextResponse.json({ results: [], error: 'Daily search limit reached for your plan' }, { status: 429 })
  const parsed = Query.safeParse({ q: new URL(req.url).searchParams.get('q') ?? '' })
  if (!parsed.success) return NextResponse.json({ results: [] })
  const results = await searchCompanies(parsed.data.q)
  return NextResponse.json({ results })
}
