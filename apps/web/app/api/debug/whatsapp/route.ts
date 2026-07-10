// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

// Staff-only: shows the exact state of the WhatsApp pipeline.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not authorized — sign in as admin first.' }, { status: 403 })
  }

  const admin = await createAdminClient()
  const out: any = {}

  // 1. Channels (is the shared number activated? does is_shared exist?)
  const ch = await admin.from('whatsapp_channels').select('phone_number_id, display_number, is_active, is_shared, business_id, van_id').limit(10)
  out.channels = ch.error ? `FAIL: ${ch.error.message}` : (ch.data ?? []).map((c: any) => ({
    ...c, token_saved: undefined,
  }))
  if (String(out.channels).includes?.('is_shared') || ch.error?.message?.includes('is_shared')) {
    out.hint_sql = 'The is_shared SQL migration has NOT been run — run it in Supabase.'
  }

  // 2. Did any webhook messages arrive?
  const msgs = await admin.from('whatsapp_messages').select('from_phone, body, outcome, created_at').order('created_at', { ascending: false }).limit(10)
  out.recent_messages = msgs.error ? `FAIL: ${msgs.error.message}` : msgs.data

  // 3. Customer prefs table present?
  const prefs = await admin.from('whatsapp_customer_prefs').select('phone, van_id').limit(3)
  out.customer_prefs = prefs.error ? `FAIL: ${prefs.error.message}` : prefs.data

  // 4. Verdict
  const channels = Array.isArray(out.channels) ? out.channels : []
  const sharedCh = channels.find((c: any) => c.is_shared && c.is_active)
  const msgsArr = Array.isArray(out.recent_messages) ? out.recent_messages : []
  out.verdict = typeof out.channels === 'string'
    ? '❌ Channels table query failed — run the is_shared SQL in Supabase.'
    : !sharedCh
      ? '❌ No ACTIVE shared channel — go to /admin/whatsapp, tick 🌐 Shared, enter Phone number ID 1154488224421088 + token, Activate.'
      : msgsArr.length === 0
        ? '⚠️ Shared channel is active but NO messages have arrived from Meta — check webhook subscription/Live mode, then text the number again.'
        : `Channel active and ${msgsArr.length} message(s) received — check "outcome" on the latest message for what happened.`

  return NextResponse.json(out)
}
