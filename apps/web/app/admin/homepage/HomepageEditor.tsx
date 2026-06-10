'use client'
// @ts-nocheck
import { useState } from 'react'

type Section = { key: string; title: string; position: number; visible: boolean }

const ICONS: Record<string, string> = {
  hero:         '🦸',
  stats:        '📊',
  categories:   '🍔',
  vans_live:    '🚐',
  map:          '🗺️',
  how:          '📋',
  popular:      '⭐',
  pricing:      '💰',
  testimonials: '💬',
  cta:          '🚀',
}

export function HomepageEditor({ initial }: { initial: Section[] }) {
  const [sections, setSections] = useState<Section[]>(
    [...initial].sort((a, b) => a.position - b.position)
  )
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function move(index: number, dir: -1 | 1) {
    const next = [...sections]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSections(next.map((s, i) => ({ ...s, position: i + 1 })))
    setStatus('idle')
  }

  function toggle(index: number) {
    const next = [...sections]
    next[index] = { ...next[index], visible: !next[index].visible }
    setSections(next)
    setStatus('idle')
  }

  async function save() {
    setSaving(true)
    setStatus('idle')
    setErrorMsg('')
    try {
      const res = await fetch('/api/admin/homepage-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sections),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 3000)
      } else {
        setStatus('error')
        setErrorMsg(body.error ?? `Server error ${res.status}`)
      }
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e.message ?? 'Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:16, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#fff' }}>Homepage Sections</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:0 }}>Reorder with ↑↓ and toggle visibility. Press Save — homepage updates live.</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ background: saving ? 'rgba(251,191,36,.4)' : status === 'saved' ? 'rgba(16,185,129,.8)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#0a0a14', border:'none', borderRadius:10, padding:'11px 24px', fontWeight:800, fontSize:14, cursor: saving ? 'wait' : 'pointer', flexShrink:0 }}>
          {saving ? 'Saving…' : status === 'saved' ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Error banner */}
      {status === 'error' && (
        <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, padding:'12px 16px', marginBottom:16, color:'#fca5a5', fontSize:13 }}>
          ⚠️ Save failed: {errorMsg}
          <div style={{ marginTop:6, fontSize:12, color:'rgba(255,255,255,.4)' }}>
            Make sure you've created the <code style={{ background:'rgba(255,255,255,.08)', padding:'1px 5px', borderRadius:4 }}>homepage_sections</code> table in Supabase. Run this SQL:
          </div>
          <pre style={{ marginTop:8, fontSize:11, color:'rgba(255,255,255,.5)', background:'rgba(255,255,255,.04)', padding:10, borderRadius:8, overflow:'auto', whiteSpace:'pre-wrap' }}>{`create table if not exists homepage_sections (
  key text primary key,
  title text not null,
  position integer not null,
  visible boolean not null default true
);
alter table homepage_sections enable row level security;
create policy "Allow all" on homepage_sections
  for all using (true) with check (true);`}</pre>
        </div>
      )}

      {/* Success banner */}
      {status === 'saved' && (
        <div style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.3)', borderRadius:10, padding:'12px 16px', marginBottom:16, color:'#6ee7b7', fontSize:13 }}>
          ✅ Saved! Homepage will reflect changes on next load.
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {sections.map((s, i) => (
          <div key={s.key} style={{ display:'flex', alignItems:'center', gap:10, background: s.visible ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)', border:`1px solid ${s.visible ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)'}`, borderRadius:14, padding:'12px 14px', opacity: s.visible ? 1 : 0.5, transition:'opacity .2s' }}>

            {/* position number */}
            <div style={{ width:26, height:26, borderRadius:8, background:'rgba(255,255,255,.07)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'rgba(255,255,255,.5)', flexShrink:0 }}>{i + 1}</div>

            {/* icon + title */}
            <span style={{ fontSize:18, flexShrink:0 }}>{ICONS[s.key] ?? '📄'}</span>
            <span style={{ flex:1, fontSize:14, fontWeight:600, color: s.visible ? '#fff' : 'rgba(255,255,255,.35)', minWidth:0 }}>{s.title}</span>

            {/* up/down arrows */}
            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
              <button onClick={() => move(i, -1)} disabled={i === 0}
                style={{ width:34, height:34, borderRadius:8, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)', color:'#fff', fontSize:16, cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.25 : 1, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === sections.length - 1}
                style={{ width:34, height:34, borderRadius:8, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)', color:'#fff', fontSize:16, cursor: i === sections.length - 1 ? 'not-allowed' : 'pointer', opacity: i === sections.length - 1 ? 0.25 : 1, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>↓</button>
            </div>

            {/* visibility toggle */}
            <button onClick={() => toggle(i)}
              style={{ width:46, height:26, borderRadius:13, border:'none', cursor:'pointer', background: s.visible ? '#10b981' : 'rgba(255,255,255,.1)', position:'relative', transition:'background .2s', flexShrink:0 }}>
              <span style={{ position:'absolute', top:3, left: s.visible ? 23 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .18s', display:'block' }} />
            </button>

            <span style={{ fontSize:11, fontWeight:700, color: s.visible ? '#10b981' : 'rgba(255,255,255,.3)', width:32, textAlign:'center', flexShrink:0 }}>{s.visible ? 'On' : 'Off'}</span>
          </div>
        ))}
      </div>

      <p style={{ marginTop:16, fontSize:12, color:'rgba(255,255,255,.2)', textAlign:'center' }}>
        Changes only apply after pressing Save Changes
      </p>
    </div>
  )
}
