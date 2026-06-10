// @ts-nocheck
import { createAdminClient } from '@/lib/supabase/server'
import { AdminShell } from '../_shared'

export const dynamic = 'force-dynamic'

const CREATE_TABLE_SQL = `create table if not exists discovered_businesses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  business_type text,
  source text default 'overpass',
  osm_id text unique,
  status text default 'discovered',
  invitation_sent_at timestamptz,
  notes text,
  created_at timestamptz default now()
);`

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, any> = {
    discovered: { background: 'rgba(107,114,128,.2)', color: '#9ca3af', border: '1px solid rgba(107,114,128,.3)' },
    invited:    { background: 'rgba(251,191,36,.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,.3)' },
    converted:  { background: 'rgba(16,185,129,.15)', color: '#34d399', border: '1px solid rgba(16,185,129,.3)' },
  }
  const s = styles[status] ?? styles.discovered
  return (
    <span style={{ ...s, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
      {status}
    </span>
  )
}

export default async function AdminDiscoveryPage() {
  const supabase = await createAdminClient()

  let businesses: any[] = []
  let tableExists = true

  try {
    const { data, error } = await supabase
      .from('discovered_businesses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        tableExists = false
      } else {
        tableExists = true
        businesses = []
      }
    } else {
      businesses = data ?? []
    }
  } catch {
    tableExists = false
  }

  return (
    <AdminShell active="/admin/discovery">
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Discovery</h1>
      <p style={{ color: 'rgba(255,255,255,.4)', margin: '0 0 24px', fontSize: 13 }}>
        Nearby food businesses found via OpenStreetMap — potential FoodTaxi partners
      </p>

      {!tableExists ? (
        /* Table doesn't exist yet — show setup card */
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>⚠️ Table Not Set Up</div>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, margin: '0 0 16px' }}>
            The <code style={{ background: 'rgba(255,255,255,.08)', padding: '1px 6px', borderRadius: 4 }}>discovered_businesses</code> table does not exist yet.
            Run the following SQL in your Supabase SQL editor:
          </p>
          <pre style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 16, fontSize: 12, color: '#a5b4fc', overflowX: 'auto', margin: 0 }}>
            {CREATE_TABLE_SQL}
          </pre>
        </div>
      ) : (
        <>
          {/* Count card */}
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28 }}>🔍</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#a5b4fc', lineHeight: 1 }}>{businesses.length}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 4 }}>Discovered Businesses</div>
            </div>
          </div>

          {businesses.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>No discovered businesses yet. They appear here when users tap "Invite" on the map.</div>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                      {['Name', 'Type', 'Address', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,.4)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {businesses.map((biz) => {
                      const waMsg = encodeURIComponent(`Hi ${biz.name}! We found your business on OpenStreetMap and wanted to invite you to join FoodTaxi — the live street food tracking app. Join free at foodtaxi.co.uk`)
                      const mailSubject = encodeURIComponent(`Join FoodTaxi — ${biz.name}`)
                      const mailBody = encodeURIComponent(`Hi ${biz.name},\n\nWe noticed your business and wanted to invite you to join FoodTaxi — the app that helps customers find street food in real time.\n\nSign up free at foodtaxi.co.uk\n\nBest wishes,\nThe FoodTaxi Team`)

                      return (
                        <tr key={biz.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{biz.name}</td>
                          <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,.5)' }}>{biz.business_type ?? '—'}</td>
                          <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,.45)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{biz.address || '—'}</td>
                          <td style={{ padding: '12px 16px' }}><StatusBadge status={biz.status ?? 'discovered'} /></td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {biz.phone && (
                                <a
                                  href={`https://wa.me/${biz.phone.replace(/\D/g, '')}?text=${waMsg}`}
                                  target="_blank"
                                  style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.25)', color: '#86efac', textDecoration: 'none', whiteSpace: 'nowrap' }}
                                >
                                  💬 WhatsApp
                                </a>
                              )}
                              <a
                                href={`mailto:?subject=${mailSubject}&body=${mailBody}`}
                                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)', color: '#a5b4fc', textDecoration: 'none', whiteSpace: 'nowrap' }}
                              >
                                ✉️ Email
                              </a>
                              <form action="/api/discovery/convert" method="POST" style={{ display: 'inline' }}>
                                <input type="hidden" name="id" value={biz.id} />
                                <button
                                  type="submit"
                                  style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)', color: '#34d399', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  ✅ Convert
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </AdminShell>
  )
}
