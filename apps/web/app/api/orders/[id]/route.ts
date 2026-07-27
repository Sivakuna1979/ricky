// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

// DELETE /api/orders/[id] — permanently removes an order (and its items,
// via ON DELETE CASCADE). Super-admin only, for wiping test/junk data
// before a real launch. Not exposed to ordinary business owners: real
// order history should be cancelled, never hard-deleted, so accounting/
// dispute records stay intact.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const admin = await createAdminClient()
  const { error } = await admin.from('orders').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
