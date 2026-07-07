// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

// Staff-only overview: pending requests, existing channels, all businesses+vans.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const admin = await createAdminClient()
  const [{ data: requests }, { data: channels }, { data: businesses }, { data: vans }] = await Promise.all([
    admin.from('whatsapp_requests').select('*').order('created_at', { ascending: false }).limit(100),
    admin.from('whatsapp_channels').select('id, business_id, van_id, phone_number_id, display_number, is_active, created_at'),
    admin.from('businesses').select('id, name, phone').order('name'),
    admin.from('vans').select('id, name, business_id'),
  ])
  return NextResponse.json({ requests: requests ?? [], channels: channels ?? [], businesses: businesses ?? [], vans: vans ?? [] })
}
