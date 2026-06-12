// @ts-nocheck
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0a14', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ textAlign:'center', maxWidth:480 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:32, textDecoration:'none' }}>
          <div style={{ width:48, height:48, borderRadius:12, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ color:'#fff', fontSize:17, fontWeight:900 }}>FT</span>
          </div>
          <span style={{ fontSize:24, fontWeight:800, color:'#fff', letterSpacing:'-0.04em' }}>
            Food<span style={{ color:'#f97316' }}>Taxi</span>
          </span>
        </div>
        <div style={{ fontSize:80, fontWeight:900, color:'#f97316', lineHeight:1, marginBottom:16 }}>404</div>
        <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:'0 0 12px' }}>Page not found</h1>
        <p style={{ color:'rgba(255,255,255,0.4)', fontSize:15, lineHeight:1.6, margin:'0 0 32px' }}>
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/" style={{ padding:'12px 28px', borderRadius:50, background:'linear-gradient(135deg,#fbbf24,#f59e0b)', color:'#0a0a14', fontWeight:800, fontSize:15, textDecoration:'none' }}>
            Go Home
          </Link>
          <Link href="/login" style={{ padding:'12px 28px', borderRadius:50, border:'1px solid rgba(255,255,255,0.2)', color:'#fff', fontWeight:700, fontSize:15, textDecoration:'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
