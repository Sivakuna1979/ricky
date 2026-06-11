// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

const DEFAULT_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    period: 'month',
    description: 'Perfect for a single van operator',
    features: ['1 Van', 'QR Menu', 'GPS Tracking', 'Online Orders', 'Customer Reviews', 'Email Support'],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 59,
    period: 'month',
    description: 'Growing businesses with multiple vans',
    features: ['Up to 3 Vans', 'Everything in Starter', 'Priority Support', 'Advanced Analytics', 'Custom Menu Design', 'SMS Notifications'],
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 99,
    period: 'month',
    description: 'Large fleets and enterprise businesses',
    features: ['Unlimited Vans', 'Everything in Pro', 'Dedicated Account Manager', 'API Access', 'White Label Option', 'Custom Reporting'],
    highlight: false,
  },
]

function PlanCard({ plan, onEdit }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '24px 22px',
      boxShadow: plan.highlight ? '0 4px 20px rgba(99,102,241,0.15)' : '0 1px 4px rgba(0,0,0,0.08)',
      border: plan.highlight ? '2px solid #6366f1' : '1px solid #e5e7eb',
      position: 'relative',
    }}>
      {plan.highlight && (
        <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          MOST POPULAR
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{plan.name}</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{plan.description}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: plan.highlight ? '#6366f1' : '#111' }}>£{plan.price}</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>/{plan.period}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {plan.features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444' }}>
            <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
          </div>
        ))}
      </div>
      <button onClick={() => onEdit(plan)} style={{ width: '100%', padding: '9px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#555', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        Edit Plan
      </button>
    </div>
  )
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState(DEFAULT_PLANS)
  const [editing, setEditing] = useState(null)
  const [newFeature, setNewFeature] = useState('')

  const saveEdit = () => {
    setPlans(ps => ps.map(p => p.id === editing.id ? editing : p))
    setEditing(null)
  }

  const addFeature = () => {
    if (!newFeature.trim()) return
    setEditing(e => ({ ...e, features: [...e.features, newFeature.trim()] }))
    setNewFeature('')
  }

  const removeFeature = (i) => {
    setEditing(e => ({ ...e, features: e.features.filter((_, idx) => idx !== i) }))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, height: 56, position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/admin/dashboard" style={{ color: '#6366f1', fontWeight: 900, textDecoration: 'none', fontSize: 22 }}>🍟</a>
        <span style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>Pricing Plans</span>
        <div style={{ flex: 1 }} />
        <a href="/admin/settings" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← Settings</a>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: '0 0 6px' }}>FoodTaxi Subscription Plans</h2>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
            These plans are shown on your public pricing page and used for business owner subscriptions.
            Connect to Stripe in Settings → Billing to process payments.
          </p>
        </div>

        {/* Notice banner */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', marginBottom: 24, fontSize: 13, color: '#1e40af' }}>
          💡 <b>How pricing works:</b> Business owners see these plans when they register. Payments are processed via Stripe. To connect Stripe, go to{' '}
          <a href="/admin/settings" style={{ color: '#6366f1', fontWeight: 700 }}>Settings → Billing</a>.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20, marginBottom: 32 }}>
          {plans.map(plan => (
            <PlanCard key={plan.id} plan={plan} onEdit={setEditing} />
          ))}
        </div>

        {/* What business owners see */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 12 }}>What Registered Businesses See</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['📊 Dashboard', 'Sales stats, orders today, live van count', '/dashboard'],
              ['🚐 My Vans', 'Add/edit vans, start GPS tracking, manage menus', '/dashboard/vans'],
              ['📦 Orders', 'Live orders board, order history, fulfilment', '/dashboard/orders'],
              ['💳 My Plan', 'Current subscription, upgrade/downgrade, invoices', '/dashboard/billing'],
              ['🎪 Event Board', 'Browse and apply for FoodTaxi event opportunities', '/van/events'],
            ].map(([icon, desc, href]) => (
              <div key={href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', minWidth: 140 }}>{icon}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#666' }}>{desc}</div>
                <a href={href} target="_blank" style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>Preview →</a>
              </div>
            ))}
          </div>
        </div>

        {/* Stripe link */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 6 }}>Payment Processing</div>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px' }}>Subscriptions and payments are managed through Stripe. Click below to manage plans, invoices, and subscriber details.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener noreferrer"
              style={{ padding: '9px 20px', borderRadius: 10, background: '#635bff', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Open Stripe Dashboard ↗
            </a>
            <a href="https://dashboard.stripe.com/subscriptions" target="_blank" rel="noopener noreferrer"
              style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              View Subscriptions ↗
            </a>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Edit {editing.name} Plan</div>
              <button onClick={() => setEditing(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>×</button>
            </div>

            {[['Plan Name', 'name', 'text'], ['Price (£/month)', 'price', 'number'], ['Description', 'description', 'text']].map(([lbl, key, type]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>{lbl}</label>
                <input type={type} value={editing[key]} onChange={e => setEditing(ed => ({ ...ed, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6 }}>Features</label>
              {editing.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 13, padding: '6px 10px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>{f}</span>
                  <button onClick={() => removeFeature(i)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input value={newFeature} onChange={e => setNewFeature(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFeature()}
                  placeholder="Add a feature…"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }} />
                <button onClick={addFeature} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add</button>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
              <input type="checkbox" checked={editing.highlight} onChange={e => setEditing(ed => ({ ...ed, highlight: e.target.checked }))} />
              Mark as "Most Popular"
            </label>

            <button onClick={saveEdit} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Save Plan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
