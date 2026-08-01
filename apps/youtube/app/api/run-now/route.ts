import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ensureScheduleAndEnqueue } from '@/lib/pipeline/scheduling'

// Manual "produce today's videos now" button, for testing or for catching
// up a slot the scheduled cron missed. Uses the same idempotent
// ensureScheduleAndEnqueue() as the cron route, so it can't double-produce
// a slot that's already planned/filled.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const result = await ensureScheduleAndEnqueue(admin, today)
  return NextResponse.json({ ok: true, ...result })
}
