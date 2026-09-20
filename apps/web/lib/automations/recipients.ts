// @ts-nocheck
// Who should be notified for a given business + permission (D36 — staff
// only see automations relevant to their role). Always the owner, plus
// any active staff whose role actually grants the relevant permission.
import { hasPermission, staffRoleToBusinessRole, type Permission } from '@/lib/permissions'

export type Recipient = { user_id: string; email: string | null; phone: string | null; is_owner: boolean }

export async function getRecipients(admin: any, businessId: string, permission: Permission): Promise<Recipient[]> {
  const { data: business } = await admin.from('businesses').select('owner_id, phone, email').eq('id', businessId).maybeSingle()
  const recipients: Recipient[] = []

  if (business?.owner_id) {
    const { data: ownerUser } = await admin.from('users').select('id, email').eq('id', business.owner_id).maybeSingle()
    if (ownerUser) recipients.push({ user_id: ownerUser.id, email: ownerUser.email, phone: business.phone ?? null, is_owner: true })
  }

  const { data: staffRows } = await admin.from('staff').select('user_id, role, users(email)').eq('business_id', businessId).eq('is_active', true)
  const seen = new Set(recipients.map(r => r.user_id))
  for (const row of staffRows ?? []) {
    if (seen.has(row.user_id)) continue
    const role = staffRoleToBusinessRole(row.role)
    if (!role || !hasPermission(role, permission)) continue
    seen.add(row.user_id)
    recipients.push({ user_id: row.user_id, email: row.users?.email ?? null, phone: null, is_owner: false })
  }

  return recipients
}
