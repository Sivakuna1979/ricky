'use client'
// @ts-nocheck
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight:'100vh', background:'#f5f6fa', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ textAlign:'center', maxWidth:480 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <h1 style={{ fontSize:20, fontWeight:800, color:'#111', margin:'0 0 8px' }}>Something went wrong</h1>
        <p style={{ fontSize:14, color:'#888', margin:'0 0 24px' }}>{error?.message ?? 'An unexpected error occurred loading this page.'}</p>
        <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
          <button onClick={reset} style={{ padding:'11px 24px', borderRadius:10, background:'#f97316', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer' }}>Try Again</button>
          <a href="/dashboard" style={{ padding:'11px 24px', borderRadius:10, border:'1px solid #e5e7eb', color:'#555', fontWeight:700, fontSize:14, textDecoration:'none' }}>← Dashboard</a>
        </div>
      </div>
    </div>
  )
}
