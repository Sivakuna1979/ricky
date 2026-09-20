// @ts-nocheck
// Business Memory (Phase F) — free-text notes, optionally semantically
// searchable. Document isolation: every query is scoped to ctx.businessId,
// resolved server-side from the session, and RLS backs it up (same
// pattern as every Phase C/D table).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getEmbedding, EMBEDDING_MODEL } from '@/lib/memory/embeddings'
import { searchBusinessMemory } from '@/lib/memory/search'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const admin = await createAdminClient()

  if (q?.trim()) {
    const { results, semantic } = await searchBusinessMemory(admin, ctx.businessId, q.trim())
    return NextResponse.json({ notes: results, semantic })
  }

  const { data, error } = await admin.from('business_memory').select('id, category, title, content, created_at, users(full_name)').eq('business_id', ctx.businessId).order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data, semantic: false })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_business_memory')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!body.content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  const admin = await createAdminClient()
  const embedding = await getEmbedding(`${body.title ?? ''} ${body.content}`.trim())

  const { data, error } = await admin.from('business_memory').insert({
    business_id: ctx.businessId, created_by: ctx.userId,
    category: body.category ?? 'general', title: body.title ?? null, content: body.content.trim(),
    related_entity_type: body.related_entity_type ?? null, related_entity_id: body.related_entity_id ?? null,
    embedding, embedding_model: embedding ? EMBEDDING_MODEL : null,
  }).select('id, category, title, content, created_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
