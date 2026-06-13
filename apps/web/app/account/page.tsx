// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Account — FoodTaxi' }

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Super admin shouldn't land here
  if (user.email === 'sivakuna@icloud.com') redirect('/admin/dashboard')

  const { data: profile } = await supabase
    .from('users').select('full_name, role, email').eq('auth_id', user.id).maybeSingle()

  const name = profile?.full_name ?? user.email?.split('@')[0] ?? 'there'
  const role = profile?.role ?? 'customer'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#e2e8f0', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#f97316,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>FT</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Food<span style={{ color: '#f97316' }}>Taxi</span></span>
          </Link>
          <a href="/logout" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', textDecoration: 'none', padding: '8px 16px', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10 }}>Sign out</a>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>Hi {name} 👋</h1>
        <p style={{ color: 'rgba(255,255,255,.45)', margin: '0 0 28px', fontSize: 15 }}>Welcome to your FoodTaxi account.</p>

        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.35)', marginBottom: 14, fontWeight: 700 }}>Account details</div>
          {[['Email', user.email], ['Name', name], ['Account type', role]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 14 }}>
              <span style={{ color: 'rgba(255,255,255,.45)' }}>{k}</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Link href="/search" style={{ display: 'block', padding: '18px 20px', borderRadius: 14, background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.3)', textDecoration: 'none', color: '#fff' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Find Vans</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Discover food near you</div>
          </Link>
          <Link href="/register/business" style={{ display: 'block', padding: '18px 20px', borderRadius: 14, background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)', textDecoration: 'none', color: '#fff' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🚐</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>List Your Business</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Become a partner</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
