// @ts-nocheck
export const metadata = { title: 'Privacy Policy — FoodTaxi' }

export default function PrivacyPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#e5e7eb', fontFamily:'system-ui,-apple-system,sans-serif', padding:'40px 20px' }}>
      <div style={{ maxWidth:720, margin:'0 auto', lineHeight:1.7, fontSize:15 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:'#fff' }}>Privacy Policy</h1>
        <p style={{ color:'#9ca3af' }}>Last updated: July 2026</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Who we are</h2>
        <p>FoodTaxi ("we", "us") operates the FoodTaxi platform, which connects customers with mobile food businesses for ordering, event bookings and food-safety record keeping.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>What we collect</h2>
        <p>When you place an order (via our website or WhatsApp) we collect your name, phone number, order details and pickup preferences so the food business can prepare and hand over your order. Business users additionally provide business details, menus, schedules and food-safety records they choose to keep.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>WhatsApp messages</h2>
        <p>If you message our WhatsApp ordering number, we process the content of your messages to take your order, using automated (AI) processing. Messages are used only to fulfil your order and improve the ordering service. We never sell your data or use it for third-party advertising.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Who sees your data</h2>
        <p>Your order details are shared with the food business you order from. We use trusted processors to run the platform (hosting, database, AI processing, payments via Stripe, messaging via Meta's WhatsApp Business Platform). We do not sell personal data.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Retention & your rights</h2>
        <p>We keep order records as long as needed for the business's legal and accounting obligations. You may request access to, correction of, or deletion of your personal data at any time.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Contact</h2>
        <p>For any privacy question or request, contact us at sivakuna@icloud.com.</p>
      </div>
    </div>
  )
}
