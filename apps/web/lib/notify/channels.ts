// @ts-nocheck
// Thin external-channel senders for Phase D automation notifications.
// Mirrors the existing send patterns already used elsewhere in FoodTaxi
// (Resend for email in app/api/marketing/send, Twilio for SMS in
// app/api/orders/manage) — same env vars, same providers — implemented
// fresh here rather than importing those routes' local/inline functions,
// so Phase D can't accidentally change behaviour in the working £29.99
// event flow, order-ready SMS, or marketing email routes.
//
// WhatsApp is deliberately NOT implemented here yet: business-to-owner
// automation messages would need either an open 24-hour session window or
// an approved message template, neither of which FoodTaxi has set up for
// this purpose. The `whatsapp` channel toggle exists in the data model
// (D7) so the control centre UI is complete, but selecting it currently
// has no delivery effect — see docs/FOODTAXI-TECHNICAL-BASELINE.md.
import { Resend } from 'resend'

export async function sendAutomationEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: 'not_configured' }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const from = process.env.EMAIL_FROM ?? 'noreply@foodtaxi.co.uk'
    await resend.emails.send({ from, to, subject, html })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'send_failed' }
  }
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('0')) return `+44${trimmed.slice(1)}`
  return trimmed
}

export async function sendAutomationSms(to: string | null | undefined, body: string): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from || sid.includes('...')) return { ok: false, error: 'not_configured' }
  const phone = normalizePhone(to)
  if (!phone) return { ok: false, error: 'no_phone' }
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: phone, From: from, Body: body }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: `sms_failed: ${err.message ?? res.status}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'sms_failed' }
  }
}
