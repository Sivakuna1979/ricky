import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Update an agent. RLS ensures the caller can only touch agents in their own
// workspace, so we scope by id and let the policy enforce ownership.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['name', 'system_prompt', 'model', 'temperature', 'voice_enabled', 'tools_enabled']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) if (key in body) update[key] = body[key]

  const { error } = await supabase.from('agents').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
