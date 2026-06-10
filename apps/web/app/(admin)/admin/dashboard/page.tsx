// @ts-nocheck
// Temporarily no auth check — debugging session persistence
export const dynamic = 'force-dynamic'

export default function AdminDashboardPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#070b14', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, fontFamily:'sans-serif', padding:24 }}>
      <div style={{ fontSize:48 }}>✅</div>
      <h1 style={{ fontSize:28, fontWeight:800, margin:0 }}>You reached the Admin Dashboard</h1>
      <p style={{ color:'rgba(255,255,255,.5)', margin:0 }}>Session is working correctly.</p>
      <a href="/admin/dashboard/real" style={{ background:'linear-gradient(135deg,#fbbf24,#f59e0b)', color:'#000', padding:'12px 28px', borderRadius:50, fontWeight:800, textDecoration:'none', fontSize:15 }}>
        Go to Full Dashboard →
      </a>
    </div>
  )
}
