// @ts-nocheck
import { AdminShell } from '../_shared'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  let users: any[] = []
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('users')
      .select('id, auth_id, role, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    users = data ?? []
  } catch {}

  const roleBadge = (role: string) => {
    const map: Record<string, [string, string]> = {
      super_admin: ['#fbbf24', 'rgba(251,191,36,.15)'],
      admin:       ['#a78bfa', 'rgba(167,139,250,.15)'],
      business:    ['#60a5fa', 'rgba(96,165,250,.15)'],
      customer:    ['rgba(255,255,255,.5)', 'rgba(255,255,255,.07)'],
    }
    const [color, bg] = map[role] ?? map.customer
    return (
      <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:20, color, background:bg }}>{role ?? 'customer'}</span>
    )
  }

  return (
    <AdminShell active="/admin/users">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#fff' }}>Users</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:0 }}>{users.length} users found</p>
        </div>
      </div>

      <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, overflow:'hidden' }}>
        {users.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>No users yet</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.02)' }}>
                {['Auth ID', 'Role', 'Joined'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'12px 16px', color:'rgba(255,255,255,.35)', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                  <td style={{ padding:'12px 16px', color:'rgba(255,255,255,.5)', fontFamily:'monospace', fontSize:12 }}>{u.auth_id?.slice(0,16) ?? u.id?.slice(0,16)}…</td>
                  <td style={{ padding:'12px 16px' }}>{roleBadge(u.role)}</td>
                  <td style={{ padding:'12px 16px', color:'rgba(255,255,255,.35)', fontSize:12 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  )
}
