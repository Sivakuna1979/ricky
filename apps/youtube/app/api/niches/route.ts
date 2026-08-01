import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { detectSensitivity } from '@/lib/pipeline/topics'

const bodySchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  scores: z.object({
    search_demand_score: z.number().min(0).max(10),
    competition_score: z.number().min(0).max(10),
    advertiser_suitability_score: z.number().min(0).max(10),
    production_difficulty_score: z.number().min(0).max(10),
    evergreen_score: z.number().min(0).max(10),
    originality_potential_score: z.number().min(0).max(10),
    copyright_risk_score: z.number().min(0).max(10),
    retention_potential_score: z.number().min(0).max(10),
    uk_intl_potential_score: z.number().min(0).max(10),
  }),
  overallScore: z.number(),
  safeguardsAcknowledged: z.boolean().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('yt_niches').select('*').order('overall_score', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ niches: data })
}

// Saves a scored niche candidate (from POST /api/niches/score) as a row the
// user can later activate on a channel. Sensitive categories (medical,
// legal, financial, political, tragic-event, celebrity-rumour, children's
// content) are stored but cannot be used by the pipeline until
// safeguardsAcknowledged is explicitly set — see worker/pipeline.ts.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const sensitivity = detectSensitivity(`${parsed.data.name} ${parsed.data.description ?? ''}`)

  const { data, error } = await supabase
    .from('yt_niches')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      ...parsed.data.scores,
      overall_score: parsed.data.overallScore,
      is_sensitive: sensitivity.sensitive,
      sensitive_category: sensitivity.reason ?? null,
      safeguards_acknowledged: sensitivity.sensitive ? !!parsed.data.safeguardsAcknowledged : true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ niche: data })
}
