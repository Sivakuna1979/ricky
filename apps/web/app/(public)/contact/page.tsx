// @ts-nocheck
export const metadata = { title: 'Contact — FoodTaxi' }

export default function ContactPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#e5e7eb', fontFamily:'system-ui,-apple-system,sans-serif', padding:'40px 20px' }}>
      <div style={{ maxWidth:720, margin:'0 auto', lineHeight:1.7, fontSize:15 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:'#fff' }}>Contact Us</h1>
        <p style={{ marginTop:20 }}>Whether you're a customer with a question about an order, or a food business wanting to get set up on FoodTaxi, we'd love to hear from you.</p>

        <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:24, marginTop:24 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Email</div>
          <a href="mailto:sivakuna@icloud.com" style={{ color:'#f97316', fontSize:18, fontWeight:700, textDecoration:'none' }}>sivakuna@icloud.com</a>
        </div>

        <p style={{ marginTop:24, color:'#9ca3af', fontSize:13 }}>Ordered from a specific van and have a question about that order? It's usually fastest to contact the business directly — their number is on your order confirmation.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Want to run your food business on FoodTaxi?</h2>
        <p><a href="/register/business" style={{ color:'#f97316' }}>Start a free trial →</a></p>
      </div>
    </div>
  )
}
