// @ts-nocheck
// K53 — simple saved filters, not a BI-builder.
import { NextRequest, NextResponse } from 'next/server'
import { resolveCommandCentreContext } from '@/lib/commandCentre/context'

export async function GET() {
  const result = await resolveCommandCentreContext('view_command_centre')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business } = result

  const { data, error } = await admin.from('command_centre_saved_views').select('*').eq('business_id', business.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ views: data ?? [] })
}

export async function POST(req: NextRequest) {
  const result = await resolveCommandCentreContext('view_command_centre')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business, ctx } = result

  const { name, filters } = await req.json().catch(() => ({}))
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await admin.from('command_centre_saved_views').insert({
    business_id: business.id, created_by: ctx.userId, name: name.trim(), filters: filters ?? {},
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const result = await resolveCommandCentreContext('view_command_centre')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  const { admin, business } = result

  await admin.from('command_centre_saved_views').delete().eq('id', id).eq('business_id', business.id)
  return NextResponse.json({ ok: true })
}
