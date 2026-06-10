// @ts-nocheck
import { createAdminClient } from '../../../lib/supabase/server'
import { AdminShell } from '../_shared'
import { ImportManager } from './ImportManager'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  const db = createAdminClient()
  let businesses: any[] = []
  try {
    const { data } = await db.from('imported_businesses').select('*').order('created_at', { ascending: false }).limit(200)
    businesses = data ?? []
  } catch {}

  return (
    <AdminShell active="import">
      <ImportManager initial={businesses} />
    </AdminShell>
  )
}
