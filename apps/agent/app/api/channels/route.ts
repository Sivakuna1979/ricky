import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentContext } from '@/lib/workspace'
import { getPlan } from '@/lib/plans'

export async function POST(req: NextRequest) {
  const { workspace } = await getCurrentContext()
  if (!workspace) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const plan = getPlan(workspace.plan)

  const { count } = await supabase
    .from('channels')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
  if ((count ?? 0) >= plan.limits.channels) {
    return NextResponse.json({ error: 'Channel limit reached for your plan.' }, { status: 403 })
  }

  const body = await req.json()
  const { type, name, agent_id, credentials } = body
  if (!['whatsapp', 'telegram'].includes(type) || !name) {
    return NextResponse.json({ error: 'Invalid channel data.' }, { status: 400 })
  }

  // Default a verify token for WhatsApp if the user left it blank.
  const creds = { ...(credentials ?? {}) }
  if (type === 'whatsapp' && !creds.verify_token) {
    creds.verify_token = Math.random().toString(36).slice(2, 12)
  }

  const { data, error } = await supabase
    .from('channels')
    .insert({
      workspace_id: workspace.id,
      agent_id: agent_id || null,
      type,
      name,
      credentials: creds,
      status: 'disconnected',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ channel: data })
}
