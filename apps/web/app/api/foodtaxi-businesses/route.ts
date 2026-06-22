// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { cookies: { getAll: () => [], setAll: () => {} }, auth: { persistSession: false } }
  )
}

export async function GET(_req: NextRequest) {
  try {
    const db = getAdmin()
    const { data } = await db
      .from('businesses')
      .select('slug, postcode, name')
      .not('slug', 'is', null)
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json([])
  }
}
