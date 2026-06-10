// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData().catch(() => null)
    const json = body ? null : await req.json().catch(() => null)
    const id = body?.get('id') ?? json?.id

    if (!id) {
      return NextResponse.redirect(new URL('/admin/discovery', req.url))
    }

    const supabase = await createAdminClient()
    await supabase
      .from('discovered_businesses')
      .update({ status: 'converted' })
      .eq('id', id)

    return NextResponse.redirect(new URL('/admin/discovery', req.url))
  } catch {
    return NextResponse.redirect(new URL('/admin/discovery', req.url))
  }
}
