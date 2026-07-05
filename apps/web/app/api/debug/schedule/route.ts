// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// One-tap diagnostic for the van_schedule save problem.
// Open /api/debug/schedule in a browser — every check reports ok/fail
// with the exact database error, so we can see which layer is broken.
export async function GET() {
  const results: any = {}

  // 1. Is a real service-role key configured (not the anon fallback)?
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  results.service_key_configured = Boolean(serviceKey) && serviceKey !== anonKey && serviceKey.length > 60
  results.supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING'

  // 2. Can the anon/session client read van_schedule?
  try {
    const supabase = await createClient()
    const { error, count } = await supabase.from('van_schedule').select('id', { count: 'exact', head: true })
    results.anon_read = error ? `FAIL: ${error.code ?? ''} ${error.message}` : `OK (${count} rows)`
  } catch (e: any) {
    results.anon_read = `FAIL: ${e.message}`
  }

  const admin = await createAdminClient()

  // 3. Can the admin client read van_schedule?
  try {
    const { error, count } = await admin.from('van_schedule').select('id', { count: 'exact', head: true })
    results.admin_read = error ? `FAIL: ${error.code ?? ''} ${error.message}` : `OK (${count} rows)`
  } catch (e: any) {
    results.admin_read = `FAIL: ${e.message}`
  }

  // 4. Can the admin client actually INSERT? (probe row, deleted immediately)
  try {
    const { data: van } = await admin.from('vans').select('id').limit(1).single()
    if (!van) {
      results.admin_insert = 'SKIP: no vans exist'
    } else {
      const { data: probe, error } = await admin
        .from('van_schedule')
        .insert({ van_id: van.id, day_of_week: 0, location_name: '__DIAGNOSTIC_PROBE__', arrival_time: '00:00', departure_time: '00:01' })
        .select('id')
        .single()
      if (error) {
        results.admin_insert = `FAIL: ${error.code ?? ''} ${error.message}`
      } else {
        await admin.from('van_schedule').delete().eq('id', probe.id)
        results.admin_insert = 'OK (probe row inserted and removed)'
      }
    }
  } catch (e: any) {
    results.admin_insert = `FAIL: ${e.message}`
  }

  // 5. Who is signed in right now (helps verify the ownership path)?
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    results.signed_in_as = user?.email ?? 'NOT SIGNED IN'
  } catch (e: any) {
    results.signed_in_as = `FAIL: ${e.message}`
  }

  results.verdict = !results.service_key_configured
    ? 'SUPABASE_SERVICE_ROLE_KEY is missing or wrong in Vercel — saves fall back to the anon key.'
    : String(results.admin_insert).startsWith('OK')
      ? 'Database writes work — saving from the app should succeed.'
      : 'Service key is set but the database rejected the write — see admin_insert error above.'

  return NextResponse.json(results)
}
