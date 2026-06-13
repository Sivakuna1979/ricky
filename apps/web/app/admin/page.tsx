// @ts-nocheck
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// /admin → /admin/dashboard (the middleware guards admin access)
export default function AdminIndex() {
  redirect('/admin/dashboard')
}
