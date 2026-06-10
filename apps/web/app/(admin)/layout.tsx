// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check role — allow super_admin or SUPER_ADMIN_EMAIL bypass
  const { data: userData } = await supabase
    .from('users')
    .select('role, full_name, email')
    .eq('auth_id', user.id)
    .single()

  const role = userData?.role ?? user.user_metadata?.role
  const ownerEmail = process.env.SUPER_ADMIN_EMAIL ?? 'sivakuna@icloud.com'
  const isAdmin = role === 'super_admin' || role === 'admin' || user.email === ownerEmail

  if (!isAdmin) redirect('/dashboard')

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#070b14', color:'#fff', fontFamily:"var(--font-inter),-apple-system,'Segoe UI',sans-serif" }}>
      <main style={{ flex:1, overflowY:'auto', minWidth:0 }}>
        {children}
      </main>
    </div>
  )
}
