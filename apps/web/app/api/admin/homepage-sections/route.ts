// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const DEFAULT_SECTIONS = [
  { key: 'hero',         title: 'Hero Banner',       position: 1,  visible: true },
  { key: 'stats',        title: 'Stats Bar',          position: 2,  visible: true },
  { key: 'categories',   title: 'Food Categories',    position: 3,  visible: true },
  { key: 'vans_live',    title: 'Vans Out Today',     position: 4,  visible: true },
  { key: 'map',          title: 'Live Map',           position: 5,  visible: true },
  { key: 'how',          title: 'How It Works',       position: 6,  visible: true },
  { key: 'popular',      title: 'Popular Vans',       position: 7,  visible: true },
  { key: 'pricing',      title: 'Pricing Plans',      position: 8,  visible: true },
  { key: 'testimonials', title: 'Testimonials',       position: 9,  visible: true },
  { key: 'cta',          title: 'Call to Action',     position: 10, visible: true },
]

export async function GET() {
  try {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('homepage_sections')
      .select('*')
      .order('position')

    if (error || !data?.length) {
      // Auto-seed defaults if table empty or missing
      if (supabase) {
        await supabase.from('homepage_sections').upsert(DEFAULT_SECTIONS, { onConflict: 'key' })
      }
      return NextResponse.json(DEFAULT_SECTIONS)
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(DEFAULT_SECTIONS)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sections = await req.json()
    const supabase = await createAdminClient()
    const { error } = await supabase
      .from('homepage_sections')
      .upsert(sections, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
