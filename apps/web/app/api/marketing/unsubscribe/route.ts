// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/marketing/unsubscribe?email=... — public, no login. One-click
// unsubscribe link included in every marketing email (a legal requirement
// for UK/EU marketing emails, unlike transactional receipts). A GET request
// is the standard pattern for these links — the browser follows it the
// moment the customer clicks "unsubscribe", no extra confirm step needed.
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase()
  if (email) {
    const admin = await createAdminClient()
    await admin.from('email_unsubscribes').upsert({ email }).catch(() => {})
  }
  return NextResponse.redirect(new URL('/unsubscribed', req.url))
}
