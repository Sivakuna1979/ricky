// @ts-nocheck
export const dynamic = 'force-dynamic'

export default function AdminDashboardPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#070b14', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, fontFamily:'sans-serif', padding:24 }}>
      <div style={{ fontSize:48 }}>✅</div>
      <h1 style={{ fontSize:28, fontWeight:800, margin:0 }}>You reached the Admin Dashboard</h1>
      <p style={{ color:'rgba(255,255,255,.5)', margin:0 }}>Session is working correctly.</p>
    </div>
  )
}
