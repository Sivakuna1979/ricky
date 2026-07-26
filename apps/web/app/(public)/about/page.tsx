// @ts-nocheck
export const metadata = { title: 'About Us — FoodTaxi' }

export default function AboutPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#e5e7eb', fontFamily:'system-ui,-apple-system,sans-serif', padding:'40px 20px' }}>
      <div style={{ maxWidth:720, margin:'0 auto', lineHeight:1.7, fontSize:15 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:'#fff' }}>About FoodTaxi</h1>

        <p style={{ marginTop:20 }}>FoodTaxi helps mobile food businesses — fish and chip vans, burger trucks, coffee carts, street food stalls and event caterers — get found, take orders, and run their day-to-day trading, all from one platform.</p>

        <p>For customers, FoodTaxi makes it easy to find real mobile food businesses nearby, see where a van is trading right now with live GPS tracking, and order ahead online or by WhatsApp instead of queuing.</p>

        <p>For businesses, FoodTaxi replaces a pile of separate tools — a website, an ordering system, a till, food hygiene paperwork, event bookings — with one dashboard built specifically around how a mobile food business actually works: on the move, often single-handed, and busiest at exactly the moments there's no time to fiddle with software.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Get in touch</h2>
        <p>Running a mobile food business and want to get set up? Or a customer with a question about an order? See our <a href="/contact" style={{ color:'#f97316' }}>Contact page</a>.</p>
      </div>
    </div>
  )
}
