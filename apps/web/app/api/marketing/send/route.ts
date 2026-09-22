// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOwnedBusiness } from '@/lib/getOwnedBusiness'

const getResend = () => new Resend(process.env.RESEND_API_KEY ?? 're_placeholder')

// POST /api/marketing/send { subject, message } — sends a one-off promo
// email to every past customer of the signed-in owner's business who has a
// known email and hasn't unsubscribed. Every email gets a one-click
// unsubscribe link appended, which UK/EU rules require for marketing mail.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email is not configured for this site yet' }, { status: 503 })

  const { subject, message } = await req.json().catch(() => ({}))
  if (!subject?.trim()) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
  if (!message?.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const biz = await getOwnedBusiness(supabase, user.id)
  if (!biz) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const admin = await createAdminClient()
  const { data: vans } = await admin.from('vans').select('id').eq('business_id', biz.id)
  const vanIds = (vans ?? []).map((v: any) => v.id)
  if (!vanIds.length) return NextResponse.json({ error: 'Add a van before sending marketing emails' }, { status: 400 })

  const { data: orders } = await admin.from('orders').select('guest_email').in('van_id', vanIds).not('guest_email', 'is', null)
  const { data: unsubs } = await admin.from('email_unsubscribes').select('email')
  const unsubscribed = new Set((unsubs ?? []).map((u: any) => u.email.toLowerCase()))

  const emails = Array.from(new Set(
    (orders ?? [])
      .map((o: any) => (o.guest_email ?? '').trim().toLowerCase())
      .filter((e: string) => e && !unsubscribed.has(e))
  ))
  if (!emails.length) return NextResponse.json({ error: 'No customers to email yet' }, { status: 400 })

  const from = process.env.EMAIL_FROM ?? 'noreply@foodtaxi.co.uk'
  const resend = getResend()
  let sent = 0
  const errors: string[] = []

  // Resend's batch endpoint takes up to 100 emails per call.
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100)
    const batch = chunk.map(email => {
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'}/api/marketing/unsubscribe?email=${encodeURIComponent(email)}`
      return {
        from,
        to: email,
        subject: subject.trim(),
        text: `${message.trim()}\n\n— ${biz.name}\n\nDon't want these emails? Unsubscribe: ${unsubscribeUrl}`,
      }
    })
    try {
      await resend.batch.send(batch)
      sent += chunk.length
    } catch (e: any) {
      errors.push(e.message ?? 'Batch failed')
    }
  }

  if (!sent) return NextResponse.json({ error: errors[0] ?? 'Could not send emails' }, { status: 500 })
  return NextResponse.json({ sent, total: emails.length, errors: errors.length || undefined })
}
