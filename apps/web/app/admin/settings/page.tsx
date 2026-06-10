// @ts-nocheck
import { AdminShell } from '../_shared'

export const dynamic = 'force-dynamic'

export default function AdminSettingsPage() {
  return (
    <AdminShell active="/admin/settings">
      <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#fff' }}>Settings</h1>
      <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'0 0 32px' }}>Site configuration and admin preferences</p>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {[
          { icon:'🌐', title:'Site URL',         desc:'food-taxi.vercel.app',                  action:'Edit' },
          { icon:'📧', title:'Support Email',    desc:'support@foodtaxi.co.uk',                action:'Edit' },
          { icon:'🔐', title:'Admin Accounts',   desc:'Manage who has admin access',           action:'Manage' },
          { icon:'💳', title:'Billing / Plans',  desc:'Stripe integration and pricing config', action:'Configure' },
          { icon:'🔔', title:'Notifications',    desc:'Email and push notification settings',  action:'Configure' },
          { icon:'🗄️', title:'Database',         desc:'Supabase project: fzrridbzelijulofgzxo', action:'Open' },
        ].map(({ icon, title, desc, action }) => (
          <div key={title} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <span style={{ fontSize:22 }}>{icon}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{title}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginTop:2 }}>{desc}</div>
              </div>
            </div>
            <button style={{ fontSize:12, fontWeight:700, padding:'7px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.7)', cursor:'pointer' }}>{action}</button>
          </div>
        ))}
      </div>

      <div style={{ marginTop:32, padding:'20px', background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:14 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#ef4444', marginBottom:6 }}>⚠️ Danger Zone</div>
        <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'0 0 14px' }}>These actions are irreversible. Proceed with caution.</p>
        <button style={{ fontSize:13, fontWeight:700, padding:'9px 20px', borderRadius:8, border:'1px solid rgba(239,68,68,.4)', background:'rgba(239,68,68,.1)', color:'#ef4444', cursor:'pointer' }}>
          Clear All Cache
        </button>
      </div>
    </AdminShell>
  )
}
