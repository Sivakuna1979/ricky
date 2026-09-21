// @ts-nocheck
// M6-M9 — the group-level permission model, mirroring lib/permissions.ts's
// exact shape (a plain array-per-role map, not a DB enum) but entirely
// separate from it: a group role NEVER implies any business permission,
// and business permissions never imply a group role. GROUP_OWNER/
// GROUP_ADMIN/etc are NOT FoodTaxi Super Admin (lib/isSuperAdmin.ts) —
// distinct, unrelated concepts checked in completely different code paths.
export const GROUP_ROLES = ['GROUP_OWNER', 'GROUP_ADMIN', 'REGIONAL_MANAGER', 'GROUP_FINANCE', 'GROUP_OPERATIONS', 'GROUP_MARKETING', 'GROUP_VIEWER'] as const
export type GroupRole = typeof GROUP_ROLES[number]

export const GROUP_PERMISSIONS = [
  // Aggregate/operational visibility — never raw customer/staff PII, never
  // invoice/cash/VAT/credential detail (those are the separate "sensitive"
  // permissions below).
  'view_group_dashboard', 'view_group_businesses', 'view_group_sales_summary',
  'view_group_operations', 'view_group_stock_summary', 'view_group_routes',
  'view_group_customer_summary', 'view_group_finance_summary', 'view_group_staff_summary',
  'view_group_hygiene', 'view_group_vehicles',
  // Management actions.
  'manage_group_members', 'manage_group_templates', 'manage_group_brand',
  'manage_group_catalogue', 'manage_group_announcements', 'manage_group_events',
  'manage_group_documents', 'manage_group_integrations', 'view_group_audit',
  // M9 — deliberately separate, higher-stakes permissions. None of the
  // roles below grant `view_group_customer_contact` at all (M83's "never
  // merge/expose customer profiles across businesses" — the safest
  // reading is that group-level customer PII access isn't built at all in
  // this phase, only business-private access, unchanged).
  'view_group_finance_detail', 'view_group_staff_personal',
  'manage_group_accounting_connections', 'manage_group_payment_connections',
  'view_group_private_documents',
] as const
export type GroupPermission = typeof GROUP_PERMISSIONS[number]

const ROLE_PERMISSIONS: Record<GroupRole, GroupPermission[]> = {
  // Full group control, but still not the sensitive finance-detail/
  // payment-connection permissions by default — those stay narrowly
  // scoped even for an admin, mirroring how BUSINESS_ADMIN gets full
  // operational control but billing/payment-integration management is
  // its own deliberate grant, not implied by "admin".
  GROUP_OWNER: [...GROUP_PERMISSIONS],
  GROUP_ADMIN: [
    'view_group_dashboard', 'view_group_businesses', 'view_group_sales_summary',
    'view_group_operations', 'view_group_stock_summary', 'view_group_routes',
    'view_group_customer_summary', 'view_group_finance_summary', 'view_group_staff_summary',
    'view_group_hygiene', 'view_group_vehicles',
    'manage_group_members', 'manage_group_templates', 'manage_group_brand',
    'manage_group_catalogue', 'manage_group_announcements', 'manage_group_events',
    'manage_group_documents', 'view_group_audit',
  ],
  // Scoped to their assigned region at the API layer (lib/groups/context.ts
  // intersects every query with group_staff.region_id) — the permission
  // list here is the same shape as GROUP_ADMIN's operational view, but
  // enforcement of "only MY region" happens in code, exactly like
  // VAN_MANAGER's vanIds scoping in lib/staffContext.ts.
  REGIONAL_MANAGER: [
    'view_group_dashboard', 'view_group_businesses', 'view_group_sales_summary',
    'view_group_operations', 'view_group_stock_summary', 'view_group_routes',
    'view_group_customer_summary', 'view_group_hygiene', 'view_group_vehicles',
  ],
  // The ONE role that gets the sensitive finance-detail permission — a
  // dedicated group finance role, not bundled into general admin access.
  GROUP_FINANCE: ['view_group_dashboard', 'view_group_finance_summary', 'view_group_finance_detail'],
  GROUP_OPERATIONS: [
    'view_group_dashboard', 'view_group_operations', 'view_group_stock_summary',
    'view_group_routes', 'view_group_hygiene', 'view_group_vehicles',
    'manage_group_templates', 'manage_group_catalogue',
  ],
  GROUP_MARKETING: ['view_group_dashboard', 'view_group_customer_summary', 'manage_group_announcements', 'manage_group_events'],
  GROUP_VIEWER: ['view_group_dashboard', 'view_group_businesses'],
}

export function groupPermissionsForRole(role: GroupRole | null | undefined): GroupPermission[] {
  if (!role) return []
  return ROLE_PERMISSIONS[role] ?? []
}

export function hasGroupPermission(role: GroupRole | null | undefined, permission: GroupPermission): boolean {
  return groupPermissionsForRole(role).includes(permission)
}
