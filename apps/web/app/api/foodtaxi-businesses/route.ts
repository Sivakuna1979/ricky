// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return NextResponse.json([])

    const res = await fetch(
      `${url}/rest/v1/businesses?select=slug,postcode,name&slug=not.is.null`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) return NextResponse.json([])
    const data = await res.json()
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch {
    return NextResponse.json([])
  }
}
