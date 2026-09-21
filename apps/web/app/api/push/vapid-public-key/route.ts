// @ts-nocheck
import { NextResponse } from 'next/server'

// GET /api/push/vapid-public-key — the VAPID public key is, by design,
// public (it's embedded in every push subscription request the browser
// makes) — only VAPID_PRIVATE_KEY is a secret.
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return NextResponse.json({ error: 'Push not configured' }, { status: 503 })
  return NextResponse.json({ publicKey: key })
}
