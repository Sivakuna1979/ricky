// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const SUPER_ADMIN_EMAIL = 'sivakuna@icloud.com'

export async function PUT(req: NextRequest) {
  try {
    const { van_id, brand } = await req.json()
    if (!van_id) return NextResponse.json({ error: 'van_id required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

    if (user.email !== SUPER_ADMIN_EMAIL) {
      const { data: myVans } = await supabase.rpc('my_van_ids')
      const ids = (myVans ?? []).map((v: any) => (typeof v === 'string' ? v : v.my_van_ids ?? v.id))
      if (!ids.includes(van_id)) {
        return NextResponse.json({ error: 'You do not have permission to edit this van.' }, { status: 403 })
      }
    }

    let { error } = await supabase.from('vans').update({ brand: brand ?? null }).eq('id', van_id)
    if (error && (error.code === '42501' || /permission denied|row-level security|column .* does not exist|brand/.test(error.message))) {
      // Column may be missing pre-migration or RLS blocking — admin client retries.
      const admin = await createAdminClient()
      const retry = await admin.from('vans').update({ brand: brand ?? null }).eq('id', van_id)
      error = retry.error
    }
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to save brand' }, { status: 500 })
  }
}
