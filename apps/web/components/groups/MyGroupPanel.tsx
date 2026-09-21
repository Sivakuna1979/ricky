// @ts-nocheck
'use client'
// M10/M22 — the business-side membership panel: pending invitations,
// current active membership (with a Leave button), pending menu-template
// proposals. No group brand/name-based auto-claim exists anywhere here —
// every action is an explicit accept/reject/leave/apply/reject click.
import { useEffect, useState } from 'react'

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }
const btn = { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnDanger = { ...btn, background: '#dc2626' }
const btnSecondary = { ...btn, background: '#f5f6fa', color: '#374151', border: '1px solid #e5e7eb' }

export function MyGroupPanel({ businessId }: { businessId: string }) {
  const [invitations, setInvitations] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    fetch('/api/groups/invitations').then(r => r.json()).then(d => setInvitations(Array.isArray(d) ? d : []))
    fetch('/api/groups/menu-applications').then(r => r.json()).then(d => setApplications(Array.isArray(d) ? d : []))
  }
  useEffect(load, [])

  const respond = async (groupId: string, action: string) => {
    setBusy(groupId + action)
    await fetch(`/api/groups/${groupId}/members/${businessId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    setBusy(null); load()
  }
  const respondApplication = async (groupId: string, applicationId: string, action: string) => {
    setBusy(applicationId + action)
    const res = await fetch(`/api/groups/${groupId}/templates/${applicationId}/apply/${businessId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) alert(data.error)
    setBusy(null); load()
  }

  const active = invitations.find((i: any) => i.status === 'ACTIVE')
  const pendingInvites = invitations.filter((i: any) => i.status === 'INVITED')

  return (
    <div>
      {active && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Currently part of: {active.business_groups?.name}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>Leaving revokes group access only — nothing about this business (orders, customers, finance, staff, documents) is ever affected.</div>
          <button onClick={() => respond(active.group_id, 'leave')} disabled={busy === active.group_id + 'leave'} style={btnDanger}>Leave group</button>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Pending invitations</div>
          {pendingInvites.map((inv: any) => (
            <div key={inv.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{inv.business_groups?.name} ({inv.business_groups?.type})</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => respond(inv.group_id, 'accept')} disabled={busy === inv.group_id + 'accept'} style={btn}>Accept</button>
                <button onClick={() => respond(inv.group_id, 'reject')} disabled={busy === inv.group_id + 'reject'} style={btnSecondary}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {applications.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>Pending menu template proposals</div>
          {applications.map((app: any) => (
            <div key={app.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{app.group_menu_templates?.name} (v{app.group_menu_template_versions?.version_number}) — from {app.group_menu_templates?.business_groups?.name}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => respondApplication(app.group_menu_templates.group_id, app.id, 'apply')} disabled={busy === app.id + 'apply'} style={btn}>Apply to my menu</button>
                <button onClick={() => respondApplication(app.group_menu_templates.group_id, app.id, 'reject')} disabled={busy === app.id + 'reject'} style={btnSecondary}>Not now</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!active && pendingInvites.length === 0 && applications.length === 0 && (
        <div style={card}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>This business isn't part of any group right now. Groups are entirely optional — everything works exactly as before without one.</div>
        </div>
      )}
    </div>
  )
}
