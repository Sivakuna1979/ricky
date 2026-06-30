import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentContext } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  const { workspace } = await getCurrentContext()
  if (!workspace) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { title, content, source, agent_id } = await req.json()
  if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('knowledge_documents').insert({
    workspace_id: workspace.id,
    agent_id: agent_id || null,
    title,
    content,
    source: source ?? 'manual',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
