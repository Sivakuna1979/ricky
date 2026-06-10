'use client'
// @ts-nocheck
import { useState } from 'react'

const FOOD_TYPES = [
  'fast_food','cafe','restaurant','fish_and_chips','burger','pizza',
  'coffee','ice_cream','bakery','deli','street_food','mobile_food_vendor',
  'food_court','catering_trailer','pub','bar','other',
]

const BLANK = { name:'', food_type:'fast_food', address:'', postcode:'', latitude:'', longitude:'', phone:'', website:'', description:'' }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    active:   ['rgba(16,185,129,.15)', '#34d399'],
    hidden:   ['rgba(107,114,128,.15)', '#9ca3af'],
    converted:['rgba(99,102,241,.15)', '#a5b4fc'],
  }
  const [bg, color] = map[status] ?? map.active
  return <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:bg, color }}>{status}</span>
}

async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(postcode)}`)
    const data = await res.json()
    if (data.lat) return { lat: data.lat, lng: data.lng }
  } catch {}
  return null
}

export function ImportManager({ initial }: { initial: any[] }) {
  const [businesses, setBusinesses] = useState<any[]>(initial)
  const [form, setForm] = useState({ ...BLANK })
  const [bulkText, setBulkText] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle'|'ok'|'err'>('idle')
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState<'list'|'add'|'bulk'|'seed'>('list')
  const [geocoding, setGeocoding] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')

  const flash = (ok: boolean, m: string) => { setStatus(ok ? 'ok' : 'err'); setMsg(m); setTimeout(() => setStatus('idle'), 4000) }

  const autoGeocode = async () => {
    if (!form.postcode) return
    setGeocoding(true)
    const coords = await geocodePostcode(form.postcode)
    if (coords) setForm(f => ({ ...f, latitude: String(coords.lat), longitude: String(coords.lng) }))
    else flash(false, 'Could not geocode postcode')
    setGeocoding(false)
  }

  const addSingle = async () => {
    if (!form.name || !form.postcode) { flash(false, 'Name and postcode required'); return }
    let lat = parseFloat(form.latitude), lng = parseFloat(form.longitude)
    if (!lat || !lng) {
      const coords = await geocodePostcode(form.postcode)
      if (coords) { lat = coords.lat; lng = coords.lng } else { flash(false, 'Could not geocode postcode'); return }
    }
    setSaving(true)
    const res = await fetch('/api/admin/import-businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, latitude: lat, longitude: lng }),
    })
    const body = await res.json()
    setSaving(false)
    if (res.ok) {
      flash(true, 'Business added!')
      setForm({ ...BLANK })
      const updated = await fetch('/api/admin/import-businesses').then(r => r.json())
      setBusinesses(updated)
    } else { flash(false, body.error ?? 'Failed') }
  }

  const importBulk = async () => {
    const lines = bulkText.trim().split('\n').filter(Boolean)
    if (!lines.length) { flash(false, 'Enter at least one line'); return }
    // Format: Name, food_type, postcode, phone
    const rows = lines.map(line => {
      const [name, food_type, postcode, phone] = line.split(',').map(s => s.trim())
      return { name, food_type: food_type || 'fast_food', postcode: postcode || '', phone: phone || '' }
    }).filter(r => r.name && r.postcode)
    if (!rows.length) { flash(false, 'No valid rows. Format: Name, food_type, postcode, phone'); return }
    setSaving(true)
    const res = await fetch('/api/admin/import-businesses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows),
    })
    const body = await res.json()
    setSaving(false)
    if (res.ok) {
      flash(true, `${body.inserted} businesses imported! (geocoding happens automatically on map load)`)
      setBulkText('')
      const updated = await fetch('/api/admin/import-businesses').then(r => r.json())
      setBusinesses(updated)
    } else { flash(false, body.error ?? 'Failed') }
  }

  const seedKT9 = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/import-businesses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { name:"Chessington Fish Bar",          food_type:"fish_and_chips", address:"Hook Road, Chessington",           postcode:"KT9 1EG",  latitude:51.3565, longitude:-0.3017, phone:"", website:"", source:"seed" },
        { name:"Hook Road Burger Van",           food_type:"burger",         address:"Hook Road Layby, Chessington",    postcode:"KT9 1NG",  latitude:51.3590, longitude:-0.3040, phone:"", website:"", source:"seed" },
        { name:"Chessington Coffee Cart",        food_type:"coffee",         address:"Chessington South Station",       postcode:"KT9 2NE",  latitude:51.3530, longitude:-0.3077, phone:"", website:"", source:"seed" },
        { name:"Surrey Street Food Van",         food_type:"street_food",    address:"Leatherhead Road, Chessington",   postcode:"KT9 2NG",  latitude:51.3501, longitude:-0.3060, phone:"", website:"", source:"seed" },
        { name:"Malden Ice Cream Van",           food_type:"ice_cream",      address:"New Malden High Street",          postcode:"KT3 4BX",  latitude:51.4013, longitude:-0.2592, phone:"", website:"", source:"seed" },
        { name:"Tolworth Breakfast Van",         food_type:"fast_food",      address:"Tolworth Tower Layby, A3",        postcode:"KT6 7EL",  latitude:51.3788, longitude:-0.2820, phone:"", website:"", source:"seed" },
        { name:"Kingston Market Street Food",    food_type:"street_food",    address:"Kingston Market Place",           postcode:"KT1 1JS",  latitude:51.4112, longitude:-0.3065, phone:"", website:"", source:"seed" },
        { name:"Surbiton Coffee & Crepes",       food_type:"cafe",           address:"Surbiton Station Forecourt",      postcode:"KT6 4QT",  latitude:51.3935, longitude:-0.3042, phone:"", website:"", source:"seed" },
      ]),
    })
    const body = await res.json()
    setSaving(false)
    if (res.ok) {
      flash(true, `${body.inserted} seed businesses added near KT9!`)
      const updated = await fetch('/api/admin/import-businesses').then(r => r.json())
      setBusinesses(updated)
    } else { flash(false, body.error ?? 'Failed to seed') }
  }

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch('/api/admin/import-businesses', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b))
  }

  const visible = businesses.filter(b => filterStatus === 'all' || b.status === filterStatus)

  const tabStyle = (t: string) => ({
    padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
    background: tab === t ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'rgba(255,255,255,.06)',
    color: tab === t ? '#fff' : 'rgba(255,255,255,.5)',
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#fff' }}>Import Local Businesses</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:0 }}>Add food businesses to the map — they appear as grey "Not Yet on FoodTaxi" markers.</p>
        </div>
        <div style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:'8px 14px', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#f97316' }}>{businesses.length}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', fontWeight:600 }}>Total</div>
        </div>
      </div>

      {/* Flash */}
      {status !== 'idle' && (
        <div style={{ background: status==='ok' ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)', border:`1px solid ${status==='ok'?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'}`, borderRadius:10, padding:'12px 16px', marginBottom:16, color: status==='ok' ? '#6ee7b7' : '#fca5a5', fontSize:13 }}>
          {status==='ok' ? '✅' : '⚠️'} {msg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        <button style={tabStyle('list')} onClick={() => setTab('list')}>📋 List ({businesses.length})</button>
        <button style={tabStyle('add')} onClick={() => setTab('add')}>➕ Add Single</button>
        <button style={tabStyle('bulk')} onClick={() => setTab('bulk')}>📥 Bulk Import</button>
        <button style={tabStyle('seed')} onClick={() => setTab('seed')}>🌱 Seed KT9 Area</button>
      </div>

      {/* LIST TAB */}
      {tab === 'list' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:13, color:'rgba(255,255,255,.4)', fontWeight:600 }}>Filter:</span>
            {['all','active','hidden','converted'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding:'5px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,.1)', background: filterStatus===s ? 'rgba(249,115,22,.2)' : 'rgba(255,255,255,.04)', color: filterStatus===s ? '#f97316' : 'rgba(255,255,255,.4)', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {s}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(255,255,255,.3)', fontSize:14 }}>
              No businesses yet — add some below or run the KT9 seed.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {visible.map(b => (
                <div key={b.id} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:3 }}>{b.name}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,.4)' }}>
                      {b.food_type} · {b.postcode} {b.address ? `· ${b.address}` : ''}
                      {b.latitude ? ` · ${Number(b.latitude).toFixed(4)}, ${Number(b.longitude).toFixed(4)}` : ' · No coords'}
                    </div>
                  </div>
                  <StatusBadge status={b.status ?? 'active'} />
                  <div style={{ display:'flex', gap:6 }}>
                    {b.status !== 'hidden' && (
                      <button onClick={() => updateStatus(b.id, 'hidden')}
                        style={{ padding:'5px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)', color:'rgba(255,255,255,.4)', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        Hide
                      </button>
                    )}
                    {b.status === 'hidden' && (
                      <button onClick={() => updateStatus(b.id, 'active')}
                        style={{ padding:'5px 10px', borderRadius:8, border:'1px solid rgba(16,185,129,.3)', background:'rgba(16,185,129,.08)', color:'#34d399', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        Show
                      </button>
                    )}
                    {b.status !== 'converted' && (
                      <button onClick={() => updateStatus(b.id, 'converted')}
                        style={{ padding:'5px 10px', borderRadius:8, border:'1px solid rgba(99,102,241,.3)', background:'rgba(99,102,241,.08)', color:'#a5b4fc', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                        ✅ Convert
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD SINGLE TAB */}
      {tab === 'add' && (
        <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:16, padding:'20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {([
              ['name','Business Name','text'],
              ['food_type','Food Type','select'],
              ['address','Address','text'],
              ['postcode','Postcode','text'],
              ['phone','Phone','text'],
              ['website','Website','text'],
            ] as [string,string,string][]).map(([key, label, type]) => (
              <div key={key}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'rgba(255,255,255,.5)', marginBottom:5 }}>{label}</label>
                {type === 'select' ? (
                  <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.06)', color:'#fff', fontSize:14, outline:'none' }}>
                    {FOOD_TYPES.map(t => <option key={t} value={t} style={{ background:'#0a0f1e' }}>{t}</option>)}
                  </select>
                ) : (
                  <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={label}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.06)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
                )}
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, marginTop:14, alignItems:'end' }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'rgba(255,255,255,.5)', marginBottom:5 }}>Latitude</label>
              <input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="Auto from postcode"
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.06)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'rgba(255,255,255,.5)', marginBottom:5 }}>Longitude</label>
              <input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="Auto from postcode"
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.06)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
            </div>
            <button onClick={autoGeocode} disabled={geocoding}
              style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              {geocoding ? '⏳' : '📍 Auto'}
            </button>
          </div>

          <button onClick={addSingle} disabled={saving}
            style={{ marginTop:18, width:'100%', padding:'13px', borderRadius:12, border:'none', background: saving ? 'rgba(249,115,22,.4)' : 'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontSize:14, fontWeight:800, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Saving…' : '➕ Add Business'}
          </button>
        </div>
      )}

      {/* BULK TAB */}
      {tab === 'bulk' && (
        <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:16, padding:'20px' }}>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.5)', margin:'0 0 12px' }}>
            One business per line. Format: <code style={{ background:'rgba(255,255,255,.08)', padding:'1px 6px', borderRadius:4, color:'#fbbf24' }}>Name, food_type, postcode, phone</code>
          </p>
          <p style={{ fontSize:12, color:'rgba(255,255,255,.35)', margin:'0 0 12px' }}>
            Example:<br/>Smith's Fish Bar, fish_and_chips, KT9 1EG, 07700900000<br/>Hook Road Burgers, burger, KT9 1NG,
          </p>
          <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
            rows={10} placeholder="Name, food_type, postcode, phone"
            style={{ width:'100%', padding:'12px', borderRadius:12, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.06)', color:'#fff', fontSize:13, outline:'none', resize:'vertical', fontFamily:'monospace', boxSizing:'border-box' }} />
          <button onClick={importBulk} disabled={saving}
            style={{ marginTop:12, width:'100%', padding:'13px', borderRadius:12, border:'none', background: saving ? 'rgba(249,115,22,.4)' : 'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontSize:14, fontWeight:800, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Importing…' : '📥 Import All'}
          </button>
        </div>
      )}

      {/* SEED TAB */}
      {tab === 'seed' && (
        <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:16, padding:'24px', textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🌱</div>
          <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 8px' }}>Seed KT9 / Chessington Area</h2>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.45)', margin:'0 0 20px', maxWidth:400, marginLeft:'auto', marginRight:'auto' }}>
            Adds 8 test food businesses near KT9 2AN (Chessington, Surrey) so the map shows real-looking local data when searching that postcode.
          </p>
          <div style={{ background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.2)', borderRadius:12, padding:'12px 16px', marginBottom:20, fontSize:12, color:'rgba(251,191,36,.8)', textAlign:'left', maxWidth:400, margin:'0 auto 20px' }}>
            <strong>Businesses included:</strong><br/>
            Chessington Fish Bar (KT9 1EG)<br/>
            Hook Road Burger Van (KT9 1NG)<br/>
            Chessington Coffee Cart (KT9 2NE)<br/>
            Surrey Street Food Van (KT9 2NG)<br/>
            Malden Ice Cream Van (KT3 4BX)<br/>
            Tolworth Breakfast Van (KT6 7EL)<br/>
            Kingston Market Street Food (KT1 1JS)<br/>
            Surbiton Coffee & Crepes (KT6 4QT)
          </div>
          <button onClick={seedKT9} disabled={saving}
            style={{ padding:'14px 32px', borderRadius:12, border:'none', background: saving ? 'rgba(249,115,22,.4)' : 'linear-gradient(135deg,#f97316,#ea580c)', color:'#fff', fontSize:15, fontWeight:800, cursor: saving ? 'wait' : 'pointer', boxShadow:'0 4px 18px rgba(249,115,22,.4)' }}>
            {saving ? '⏳ Seeding…' : '🌱 Seed KT9 Businesses'}
          </button>
        </div>
      )}

      {/* SQL setup */}
      <div style={{ marginTop:24, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'16px' }}>
        <p style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.4)', margin:'0 0 8px' }}>📋 Required Supabase SQL (run once in SQL Editor):</p>
        <pre style={{ fontSize:11, color:'rgba(255,255,255,.5)', background:'rgba(255,255,255,.04)', padding:12, borderRadius:10, overflow:'auto', margin:0, whiteSpace:'pre-wrap' }}>{`create table if not exists imported_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  food_type text,
  description text,
  address text,
  postcode text,
  latitude numeric,
  longitude numeric,
  phone text,
  website text,
  source text default 'manual',
  is_registered boolean default false,
  is_live boolean default false,
  status text default 'active',
  created_at timestamptz default now(),
  unique(name, postcode)
);
alter table imported_businesses enable row level security;
create policy "Allow all" on imported_businesses for all using (true) with check (true);`}</pre>
      </div>
    </div>
  )
}
