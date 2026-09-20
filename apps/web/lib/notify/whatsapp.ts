// @ts-nocheck
// Outbound WhatsApp send for CRM campaigns (Phase I) — the same Meta
// Cloud API call app/api/webhooks/whatsapp/route.ts already uses for
// ordering replies, reimplemented independently here (not imported from
// that file) so a change to the ordering webhook can never accidentally
// affect campaign sending or vice versa.
//
// IMPORTANT — WhatsApp Business messaging policy, not a FoodTaxi choice:
// a business can only free-text a customer within 24 hours of that
// customer's last inbound message ("the session window"); outside it,
// only a pre-approved message TEMPLATE may be sent. FoodTaxi has no
// approved marketing template configured, so campaign sending only ever
// attempts a recipient who is currently inside their session window
// (see lib/crm/campaigns.ts's eligibility check, computed from
// whatsapp_messages.created_at) — everyone else is reported as
// "outside session window", never silently skipped without being
// counted (I35).
export async function sendMarketingWhatsApp(channel: { access_token: string; phone_number_id: string }, to: string, body: string): Promise<{ ok: boolean; error?: string; wamid?: string }> {
  if (!channel?.access_token || !channel?.phone_number_id) return { ok: false, error: 'missing_whatsapp_credentials' }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${channel.phone_number_id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${channel.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data)}`.slice(0, 500) }
    return { ok: true, wamid: data?.messages?.[0]?.id ?? null }
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 500) }
  }
}

export async function getWhatsAppChannelForBusiness(admin: any, businessId: string) {
  const { data: vans } = await admin.from('vans').select('id').eq('business_id', businessId)
  const vanIds = (vans ?? []).map((v: any) => v.id)
  if (!vanIds.length) return null
  const { data } = await admin.from('whatsapp_channels').select('*').in('van_id', vanIds).eq('is_active', true).limit(1).maybeSingle()
  return data ?? null
}

// A customer is only in-session if they messaged in the last 24h —
// checked against whatsapp_messages, the same inbound log the ordering
// webhook already writes to. whatsapp_messages.from_phone is Meta's raw
// format (no leading '+'); our own normalised phones always have one —
// compared here with the '+' stripped from both sides so it never
// matters which format the caller passes in.
export async function isWithinWhatsAppSessionWindow(admin: any, phone: string): Promise<boolean> {
  const bare = phone.replace(/^\+/, '')
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data } = await admin.from('whatsapp_messages').select('id').eq('from_phone', bare).gte('created_at', cutoff).limit(1).maybeSingle()
  return !!data
}
