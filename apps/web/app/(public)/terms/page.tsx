// @ts-nocheck
export const metadata = { title: 'Terms of Service — FoodTaxi' }

export default function TermsPage() {
  return (
    <div style={{ minHeight:'100vh', background:'#0a0f1e', color:'#e5e7eb', fontFamily:'system-ui,-apple-system,sans-serif', padding:'40px 20px' }}>
      <div style={{ maxWidth:720, margin:'0 auto', lineHeight:1.7, fontSize:15 }}>
        <h1 style={{ fontSize:28, fontWeight:900, color:'#fff' }}>Terms of Service</h1>
        <p style={{ color:'#9ca3af' }}>Last updated: July 2026</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>What FoodTaxi is</h2>
        <p>FoodTaxi ("we", "us", "the platform") connects customers with independent mobile food businesses ("vans", "businesses") for online ordering, event bookings, live tracking and food-safety record keeping. FoodTaxi is a technology platform — each food business is independently owned and responsible for its own food, pricing, hygiene standards and legal compliance.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Orders and payment</h2>
        <p>When you place an order through FoodTaxi, your contract for the food itself is with the food business, not with FoodTaxi. Prices, availability, collection times and order acceptance are set by the business. Online card payments are processed securely by Stripe; we do not store your card details. Cash and card-at-van payments are handled directly between you and the business.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Cancellations and refunds</h2>
        <p>Cancellation and refund requests should be made directly to the business that took your order. If a business is unable to fulfil an order it has accepted, it is responsible for offering a refund or suitable alternative.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Business accounts</h2>
        <p>If you run a food business on FoodTaxi, you're responsible for the accuracy of your menu, prices, food-hygiene records and compliance with UK food safety law. FoodTaxi provides tools to help you keep records — it does not inspect, certify or guarantee your food safety compliance, and using these tools does not replace your legal obligations to your local council.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Acceptable use</h2>
        <p>Don't misuse the platform: no fraudulent orders, no abuse of staff or customers, no attempts to interfere with the service's security or availability. We may suspend or terminate accounts that break these terms.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Liability</h2>
        <p>FoodTaxi provides the platform "as is". We work to keep it reliable but don't guarantee uninterrupted availability. To the extent permitted by law, FoodTaxi isn't liable for losses arising from food quality, business conduct, or service interruptions, beyond what's required by UK consumer law.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Changes to these terms</h2>
        <p>We may update these terms from time to time. Continued use of FoodTaxi after a change means you accept the updated terms.</p>

        <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', marginTop:28 }}>Contact</h2>
        <p>Questions about these terms? Contact us at sivakuna@icloud.com.</p>
      </div>
    </div>
  )
}
