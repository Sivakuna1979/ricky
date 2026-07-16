// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

function emailBody(e: any) {
  return `Hi${e.organiser_name ? ` ${e.organiser_name}` : ''},

We came across ${e.name}${e.date ? ` (${e.date})` : ''}${e.location ? ` at ${e.location}` : ''} and would love to be involved.

We're FoodTaxi (food-taxi.vercel.app) — a UK platform of registered mobile food businesses: fish & chips, burgers, coffee, street food and more. Our vans are fully set up for events: food hygiene records ready for inspection, online ordering for shorter queues, and reliable, professional operators.

We have vans interested in trading at your event. Could you let us know:
- whether catering pitches are still available,
- the pitch fee and power/water arrangements,
- and how to apply?

Happy to send over details of specific vans (menus, hygiene ratings, photos) that suit your event.

Best regards,
FoodTaxi Events Team
${SUPER_ADMIN_EMAIL}`
}

// POST { events: [{ name, date, location, organiser_email, organiser_name }] }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const { events } = await req.json().catch(() => ({}))
  if (!Array.isArray(events) || !events.length) {
    return NextResponse.json({ error: 'No events provided' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const hasResend = Boolean(process.env.RESEND_API_KEY && !String(process.env.RESEND_API_KEY).includes('...'))
  const resend = hasResend ? new Resend(process.env.RESEND_API_KEY) : null
  const from = process.env.EMAIL_FROM ?? 'noreply@foodtaxi.co.uk'

  const results = []
  for (const e of events.slice(0, 15)) {
    if (!e.organiser_email) {
      results.push({ name: e.name, status: 'no_email' })
      continue
    }
    // Skip if we've already contacted this organiser about this event
    const { data: dup } = await admin
      .from('event_outreach').select('id')
      .eq('organiser_email', e.organiser_email).eq('event_name', e.name)
      .limit(1).maybeSingle()
    if (dup) { results.push({ name: e.name, status: 'already_sent' }); continue }

    const subject = `Food vendors for ${e.name}${e.date ? ` — ${e.date}` : ''}`
    const body = emailBody(e)

    if (resend) {
      try {
        await resend.emails.send({
          from: `FoodTaxi Events <${from}>`,
          to: e.organiser_email,
          replyTo: SUPER_ADMIN_EMAIL,
          subject,
          text: body,
        })
        await admin.from('event_outreach').insert({ event_name: e.name, event_date: e.date, organiser_email: e.organiser_email, status: 'sent' })
        results.push({ name: e.name, status: 'sent', to: e.organiser_email })
      } catch (err: any) {
        await admin.from('event_outreach').insert({ event_name: e.name, event_date: e.date, organiser_email: e.organiser_email, status: 'failed' })
        results.push({ name: e.name, status: 'failed', error: err.message })
      }
    } else {
      // No email service configured — hand back a ready-to-send draft link
      results.push({
        name: e.name,
        status: 'draft',
        mailto: `mailto:${e.organiser_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      })
    }
  }

  return NextResponse.json({ results, provider: hasResend ? 'resend' : 'mailto' })
}
