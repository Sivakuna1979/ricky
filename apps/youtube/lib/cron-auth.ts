import { NextRequest, NextResponse } from 'next/server'

// Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`
// when the CRON_SECRET env var is set on the project — this guards the
// route against being triggered by anyone who guesses the URL.
export function requireCronSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return null // not configured — allow (documented as required for prod in SETUP.md)
  const header = request.headers.get('authorization')
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
