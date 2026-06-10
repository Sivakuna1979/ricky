'use client'
// @ts-nocheck
import { useState, useEffect } from 'react'

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
  const [saved, setSaved] = useState(false)

  function move(index: number, dir: -1 | 1) {
    const next = [...sections]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSections(next.map((s, i) => ({ ...s, position: i + 1 })))
    setSaved(false)
  }

  function toggle(index: number) {
    const next = [...sections]
    next[index] = { ...next[index], visible: !next[index].visible }
    setSections(next)
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/homepage-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sections),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>Homepage Sections</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', margin: 0 }}>Drag sections up/down and toggle visibility. Changes go live instantly on save.</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ background: saving ? 'rgba(251,191,36,.4)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#0a0a14', border: 'none', borderRadius: 10, padding: '11px 24px', fontWeight: 800, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sections.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: s.visible ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)', border: `1px solid ${s.visible ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)'}`, borderRadius: 14, padding: '14px 16px', opacity: s.visible ? 1 : 0.5, transition: 'all .2s' }}>

            {/* drag handle look */}
            <div style={{ color: 'rgba(255,255,255,.2)', fontSize: 16, cursor: 'grab', userSelect: 'none', lineHeight: 1 }}>⠿</div>

            {/* position */}
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', flexShrink: 0 }}>{i + 1}</div>

            {/* icon + title */}
            <span style={{ fontSize: 20, flexShrink: 0 }}>{ICONS[s.key] ?? '📄'}</span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: s.visible ? '#fff' : 'rgba(255,255,255,.35)' }}>{s.title}</span>

            {/* up/down */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => move(i, -1)} disabled={i === 0}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.7)', fontSize: 14, cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === sections.length - 1}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.7)', fontSize: 14, cursor: i === sections.length - 1 ? 'not-allowed' : 'pointer', opacity: i === sections.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↓</button>
            </div>

            {/* visibility toggle */}
            <button onClick={() => toggle(i)}
              style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: s.visible ? '#10b981' : 'rgba(255,255,255,.12)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 3, left: s.visible ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', display: 'block' }} />
            </button>

            <span style={{ fontSize: 11, fontWeight: 600, color: s.visible ? '#10b981' : 'rgba(255,255,255,.3)', width: 44, textAlign: 'center', flexShrink: 0 }}>{s.visible ? 'Show' : 'Hide'}</span>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,.25)', textAlign: 'center' }}>
        The homepage will reflect these settings immediately after saving.
      </p>
    </div>
  )
}
