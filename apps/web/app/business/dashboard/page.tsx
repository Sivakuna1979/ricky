// @ts-nocheck
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// /business/dashboard is an alias of the business dashboard at /dashboard
export default function BusinessDashboardAlias() {
  redirect('/dashboard')
}
