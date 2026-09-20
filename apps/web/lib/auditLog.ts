// @ts-nocheck
// First real writer to audit_logs (C29) — the table and its recommended
// shape were documented in Phase A but nothing wrote to it until now.
// Deliberately used only for the higher-risk operational changes named in
// the Phase C spec (stock adjustments, stocktake, PO status, staff role
// changes, timesheet corrections, vehicle record changes) — not every
// read or harmless page view.
export async function logAuditEvent(admin: any, params: {
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  oldValues?: any
  newValues?: any
}) {
  try {
    await admin.from('audit_logs').insert({
      actor_id: params.actorId ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
    })
  } catch (_e) {
    // Audit logging must never break the operation it's describing.
  }
}
