// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    ''
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const DEFAULT_SECTIONS = [
  { key: 'hero',              title: 'Hero Banner',      position: 1, visible: true },
  { key: 'stats',             title: 'Stats Bar',        position: 2, visible: true },
  { key: 'food_categories',   title: 'Food Categories',  position: 3, visible: true },
  { key: 'google_businesses', title: 'Local Businesses', position: 4, visible: true },
  { key: 'featured_vans',     title: 'Featured Vans',    position: 5, visible: true },
  { key: 'event_booking',     title: 'Event Booking',    position: 6, visible: true },
  { key: 'testimonials',      title: 'Testimonials',     position: 7, visible: true },
  { key: 'footer',            title: 'Footer',           position: 8, visible: true },
]

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('homepage_sections')
      .select('*')
      .order('position')

    if (error) {
      console.error('homepage_sections GET error:', error.message)
      return NextResponse.json(DEFAULT_SECTIONS)
    }

    if (!data?.length) {
      await supabase.from('homepage_sections').upsert(DEFAULT_SECTIONS, { onConflict: 'key' })
      return NextResponse.json(DEFAULT_SECTIONS)
    }

    return NextResponse.json(data)
  } catch (e: any) {
    console.error('homepage_sections GET exception:', e.message)
    return NextResponse.json(DEFAULT_SECTIONS)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sections = await req.json()
    if (!Array.isArray(sections) || !sections.length) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const rows = sections.map(({ key, title, position, visible }) => ({
      key, title, position, visible,
    }))

    const { error } = await supabase
      .from('homepage_sections')
      .upsert(rows, { onConflict: 'key' })

    if (error) {
      console.error('homepage_sections PATCH error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('homepage_sections PATCH exception:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
