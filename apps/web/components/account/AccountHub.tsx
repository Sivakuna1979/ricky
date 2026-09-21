// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'
import { pushSupported, getCurrentPushEndpoint, unsubscribeFromPush } from '@/lib/push/client'

const TABS = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'orders', label: 'Orders', icon: '🧾' },
  { id: 'favourites', label: 'Favourites', icon: '❤️' },
  { id: 'wallet', label: 'Wallet', icon: '🎁' },
  { id: 'preferences', label: 'Notifications', icon: '🔔' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

const ACTIVE_STATUSES = ['pending', 'accepted', 'preparing', 'ready']

function StatCard({ children }: any) {
  return <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 20 }}>{children}</div>
}

export default function AccountHub({ name, email }: { name: string; email: string }) {
  const [tab, setTab] = useState('overview')
  const [me, setMe] = useState<any>(null)
  const [orders, setOrders] = useState<any[] | null>(null)
  const [favVans, setFavVans] = useState<any[] | null>(null)
  const [favItems, setFavItems] = useState<any[] | null>(null)
  const [favStops, setFavStops] = useState<any[] | null>(null)
  const [wallet, setWallet] = useState<any>(null)
  const [prefs, setPrefs] = useState<any[] | null>(null)
  const [pushEndpoint, setPushEndpoint] = useState<string | null>(null)
  const [pushMarketing, setPushMarketing] = useState(false)

  useEffect(() => {
    fetch('/api/customer/me').then(r => r.json()).then(setMe).catch(() => setMe({}))
  }, [])

  useEffect(() => {
    if (tab === 'overview' || tab === 'orders') {
      fetch('/api/customer/orders').then(r => r.json()).then(d => setOrders(d.orders ?? [])).catch(() => setOrders([]))
    }
    if (tab === 'favourites') {
      fetch('/api/customer/favourites/vans').then(r => r.json()).then(d => setFavVans(d.favourites ?? [])).catch(() => setFavVans([]))
      fetch('/api/customer/favourites/items').then(r => r.json()).then(d => setFavItems(d.favourites ?? [])).catch(() => setFavItems([]))
      fetch('/api/customer/favourites/stops').then(r => r.json()).then(d => setFavStops(d.favourites ?? [])).catch(() => setFavStops([]))
    }
    if (tab === 'overview' || tab === 'wallet') {
      fetch('/api/customer/wallet').then(r => r.json()).then(setWallet).catch(() => setWallet({ loyalty: [], vouchers: [], referrals: [] }))
    }
    if (tab === 'preferences') {
      fetch('/api/customer/preferences').then(r => r.json()).then(d => setPrefs(d.preferences ?? [])).catch(() => setPrefs([]))
      if (pushSupported()) getCurrentPushEndpoint().then(setPushEndpoint).catch(() => {})
    }
  }, [tab])

  const togglePushMarketing = async (checked: boolean) => {
    if (!pushEndpoint) return
    setPushMarketing(checked)
    await fetch('/api/push/preferences', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: pushEndpoint, notify_marketing_offers: checked }),
    }).catch(() => {})
  }

  const disablePush = async () => {
    await unsubscribeFromPush()
    setPushEndpoint(null)
  }

  const activeOrder = (orders ?? []).find(o => ACTIVE_STATUSES.includes(o.status))

  const removeFavourite = async (kind: 'vans' | 'items' | 'stops', idParam: string, id: string) => {
    await fetch(`/api/customer/favourites/${kind}?${idParam}=${id}`, { method: 'DELETE' })
    if (kind === 'vans') setFavVans(v => v?.filter((x: any) => x.van_id !== id) ?? [])
    if (kind === 'items') setFavItems(v => v?.filter((x: any) => x.menu_item_id !== id) ?? [])
    if (kind === 'stops') setFavStops(v => v?.filter((x: any) => x.stop_id !== id) ?? [])
  }

  const togglePref = async (row: any, field: string, value: boolean) => {
    setPrefs(p => p!.map(r => r.id === row.id ? { ...r, [field]: value } : r))
    await fetch('/api/customer/preferences', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crm_customer_id: row.id, [field]: value }),
    }).catch(() => {})
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080c18', color: '#e2e8f0', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', paddingBottom: 60 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#f97316,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 900 }}>FT</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Food<span style={{ color: '#f97316' }}>Taxi</span></span>
          </a>
          <a href="/logout" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', textDecoration: 'none', padding: '8px 16px', border: '1px solid rgba(255,255,255,.15)', borderRadius: 10 }}>Sign out</a>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>Hi {name} 👋</h1>
        <p style={{ color: 'rgba(255,255,255,.4)', margin: '0 0 20px', fontSize: 14 }}>Your FoodTaxi account</p>

        {me?.newly_claimed_orders > 0 && (
          <div style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#6ee7b7' }}>
            ✅ We found {me.newly_claimed_orders} previous order{me.newly_claimed_orders > 1 ? 's' : ''} placed with this email and added {me.newly_claimed_orders > 1 ? 'them' : 'it'} to your history.
          </div>
        )}

        {/* Tabs */}
        <div role="tablist" aria-label="Account sections" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              style={{ flexShrink: 0, padding: '9px 14px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'rgba(249,115,22,.15)' : 'transparent',
                color: tab === t.id ? '#f97316' : 'rgba(255,255,255,.5)', fontWeight: 700, fontSize: 13 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeOrder ? (
              <a href={`/order/${activeOrder.id}`} style={{ textDecoration: 'none' }}>
                <StatCard>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>🟢 Active order</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{activeOrder.vans?.name} · #{activeOrder.order_number}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>{activeOrder.status} · £{Number(activeOrder.total).toFixed(2)} — tap to view status</div>
                </StatCard>
              </a>
            ) : (
              <StatCard><div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>No active order right now.</div></StatCard>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <a href="/search" style={{ textDecoration: 'none' }}>
                <StatCard><div style={{ fontSize: 20, marginBottom: 6 }}>🔍</div><div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Find a van</div></StatCard>
              </a>
              <button onClick={() => setTab('favourites')} style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer' }}>
                <StatCard><div style={{ fontSize: 20, marginBottom: 6 }}>❤️</div><div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Favourite vans</div></StatCard>
              </button>
            </div>

            {wallet?.loyalty?.length > 0 && (
              <StatCard>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>🎁 Loyalty</div>
                {wallet.loyalty.map((l: any) => (
                  <div key={l.business_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                    <span style={{ color: 'rgba(255,255,255,.6)' }}>{l.business_name}</span>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{l.earning_method === 'visit_stamps' ? `${l.balance} stamps` : `${l.balance} pts`}</span>
                  </div>
                ))}
              </StatCard>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders === null && <div style={{ color: 'rgba(255,255,255,.4)' }}>Loading…</div>}
            {orders?.length === 0 && <StatCard><div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>No orders yet on this account. Orders you place while signed in — or previously placed with this email — will show up here.</div></StatCard>}
            {orders?.map((o: any) => (
              <StatCard key={o.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>{o.vans?.name ?? 'FoodTaxi'} · #{o.order_number}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {(o.order_items ?? []).map((i: any) => `${i.quantity}× ${i.name}`).join(', ')}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--brand,#f97316)' }}>£{Number(o.total).toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'capitalize' }}>{o.status}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <a href={`/receipt/${o.id}`} style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', textDecoration: 'none', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '5px 10px' }}>Receipt</a>
                  {o.vans?.slug && (
                    <a href={`/van/${o.vans.slug}?reorder=${o.id}`} style={{ fontSize: 12, color: '#f97316', textDecoration: 'none', border: '1px solid rgba(249,115,22,.35)', borderRadius: 8, padding: '5px 10px', fontWeight: 700 }}>↻ Reorder</a>
                  )}
                  {o.status === 'collected' && (
                    <a href={`/feedback/${o.id}`} style={{ fontSize: 12, color: '#fbbf24', textDecoration: 'none', border: '1px solid rgba(251,191,36,.35)', borderRadius: 8, padding: '5px 10px' }}>⭐ Feedback</a>
                  )}
                </div>
              </StatCard>
            ))}
          </div>
        )}

        {tab === 'favourites' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Vans</div>
              {favVans?.length === 0 && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>No favourite vans yet — tap ❤️ on a van's page.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {favVans?.map((f: any) => (
                  <div key={f.van_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 14px' }}>
                    <a href={`/van/${f.vans?.slug}`} style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>{f.vans?.name}</a>
                    <button onClick={() => removeFavourite('vans', 'van_id', f.van_id)} aria-label={`Remove ${f.vans?.name} from favourites`} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13 }}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Items</div>
              {favItems?.length === 0 && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>No favourite items yet.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {favItems?.map((f: any) => (
                  <div key={f.menu_item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 14px' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{f.menu_items?.name}</div>
                      <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>{f.menu_items?.vans?.name}{f.menu_items?.available === false ? ' · currently unavailable' : ''}</div>
                    </div>
                    <button onClick={() => removeFavourite('items', 'menu_item_id', f.menu_item_id)} aria-label="Remove item from favourites" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13 }}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Stops</div>
              {favStops?.length === 0 && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>No favourite stops yet.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {favStops?.map((f: any) => (
                  <div key={f.stop_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 14px' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{f.van_schedule?.location_name}</div>
                      <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>{f.van_schedule?.vans?.name} · {f.van_schedule?.arrival_time}–{f.van_schedule?.departure_time}</div>
                    </div>
                    <button onClick={() => removeFavourite('stops', 'stop_id', f.stop_id)} aria-label="Remove stop from favourites" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13 }}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'wallet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Loyalty</div>
              {wallet?.loyalty?.length === 0 && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>No loyalty programmes yet — they'll appear here once you've ordered from a business that runs one.</div>}
              {wallet?.loyalty?.map((l: any) => (
                <StatCard key={l.business_id}>
                  <div style={{ fontWeight: 800, color: '#fff', fontSize: 14 }}>{l.business_name}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24', margin: '6px 0' }}>{l.earning_method === 'visit_stamps' ? `${l.balance} stamps` : `${l.balance} pts`}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Reward at {l.reward_threshold}: {l.reward_description}</div>
                </StatCard>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Vouchers &amp; offers</div>
              {wallet?.vouchers?.length === 0 && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>No active vouchers right now.</div>}
              {wallet?.vouchers?.map((v: any) => (
                <div key={v.id} style={{ background: 'rgba(16,185,129,.08)', border: '1px dashed rgba(16,185,129,.4)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, color: '#6ee7b7', fontSize: 15, letterSpacing: 1 }}>{v.code}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{v.business_name} · {v.discount_type === 'percentage' ? `${v.discount_value}% off` : `£${v.discount_value} off`}{v.expires_at ? ` · expires ${new Date(v.expires_at).toLocaleDateString('en-GB')}` : ''}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Referrals</div>
              {wallet?.referrals?.length === 0 && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>No referral codes yet — a business you order from may enable referrals.</div>}
              {wallet?.referrals?.map((r: any) => (
                <StatCard key={r.business_id}>
                  <div style={{ fontWeight: 800, color: '#fff', fontSize: 14 }}>{r.business_name}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#a78bfa', margin: '6px 0', letterSpacing: 1 }}>{r.code}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>{r.pending} pending · {r.rewarded} rewarded</div>
                  <button
                    onClick={() => {
                      if (navigator.share) navigator.share({ title: r.business_name, text: `Use my code ${r.code} at ${r.business_name} on FoodTaxi!` }).catch(() => {})
                      else navigator.clipboard?.writeText(r.code)
                    }}
                    style={{ marginTop: 8, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(167,139,250,.4)', background: 'rgba(167,139,250,.12)', color: '#a78bfa', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Share code
                  </button>
                </StatCard>
              ))}
            </div>
          </div>
        )}

        {tab === 'preferences' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pushEndpoint && (
              <StatCard>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: 14, marginBottom: 8 }}>🔔 Push notifications on this device</div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: 'rgba(255,255,255,.6)', cursor: 'pointer' }}>
                  Marketing offers via push
                  <input type="checkbox" checked={pushMarketing} onChange={(e) => togglePushMarketing(e.target.checked)} />
                </label>
                <button onClick={disablePush} style={{ marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,.15)', color: '#f87171', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Turn off push on this device</button>
              </StatCard>
            )}
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 4 }}>Marketing preferences are per business — order updates (order ready, etc.) always send regardless of these toggles.</div>
            {prefs?.length === 0 && <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>No businesses linked to this account yet.</div>}
            {prefs?.map((p: any) => (
              <StatCard key={p.id}>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: 14, marginBottom: 10 }}>{p.businesses?.name}</div>
                {[
                  ['marketing_email_opt_in', 'Email offers'],
                  ['marketing_sms_opt_in', 'SMS offers'],
                  ['marketing_whatsapp_opt_in', 'WhatsApp offers'],
                ].map(([field, label]) => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: 'rgba(255,255,255,.6)', cursor: 'pointer' }}>
                    {label}
                    <input type="checkbox" checked={!!p[field]} onChange={(e) => togglePref(p, field, e.target.checked)} />
                  </label>
                ))}
              </StatCard>
            ))}
          </div>
        )}

        {tab === 'profile' && (
          <StatCard>
            {[['Email', email], ['Name', name]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 14 }}>
                <span style={{ color: 'rgba(255,255,255,.45)' }}>{k}</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 14, lineHeight: 1.6 }}>
              Orders placed as a guest with this exact email are automatically added to your order history the next time you sign in.
            </div>
          </StatCard>
        )}
      </div>
    </div>
  )
}
