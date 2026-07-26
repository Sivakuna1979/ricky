// @ts-nocheck
export const metadata = { title: 'Cookie Policy — FoodTaxi' }

export default function CookiesPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#e5e7eb', fontFamily:'system-ui,-apple-system,sans-serif', padding:'40px 20px' }}>
      <div style={{ maxWidth:720, margin:'0 auto', lineHeight:1.7, fontSize:15 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:'#fff' }}>Cookie Policy</h1>
        <p style={{ color:'#9ca3af' }}>Last updated: July 2026</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>What we use cookies for</h2>
        <p>FoodTaxi only uses essential cookies — the kind needed to keep you signed in and your session secure. When you log in, our authentication provider (Supabase) sets a session cookie so you don't have to sign in again on every page.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>What we don't use</h2>
        <p>We don't use advertising or tracking cookies, and we don't use third-party analytics cookies. We don't sell or share cookie data with advertisers.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Managing cookies</h2>
        <p>Because we only use essential session cookies, blocking them will sign you out or prevent you from staying logged in. You can clear cookies at any time in your browser settings — you'll just need to sign in again afterwards.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Contact</h2>
        <p>Questions about cookies? Contact us at sivakuna@icloud.com.</p>
      </div>
    </div>
  )
}
