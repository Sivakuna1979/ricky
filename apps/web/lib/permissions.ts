// @ts-nocheck
// Central Phase C permissions architecture (C17) — the one place role →
// permission mappings live, instead of `if (role === ...)` scattered across
// routes. SUPER_ADMIN is platform-level and handled entirely by
// lib/isSuperAdmin.ts — it is intentionally not part of this business-role
// model at all.

export const BUSINESS_ROLES = ['OWNER', 'BUSINESS_ADMIN', 'VAN_MANAGER', 'DRIVER', 'STAFF'] as const
export type BusinessRole = typeof BUSINESS_ROLES[number]

export const PERMISSIONS = [
  'manage_business', 'manage_vans', 'manage_menu', 'manage_stock', 'stocktake',
  'record_wastage', 'manage_suppliers', 'manage_purchase_orders', 'manage_staff',
  'manage_shifts', 'manage_vehicles', 'manage_hygiene', 'use_pos', 'view_orders',
  'manage_orders', 'view_analytics', 'manage_billing',
] as const
export type Permission = typeof PERMISSIONS[number]

// OWNER always has every permission — this is not just "a role with lots of
// grants", it's the actual business owner (businesses.owner_id), so it can
// never be locked out of its own business regardless of what's listed here.
const ROLE_PERMISSIONS: Record<Exclude<BusinessRole, 'OWNER'>, Permission[]> = {
  // Everything but billing — a trusted manager runs the business day to
  // day, but the paying account stays with the owner by default.
  BUSINESS_ADMIN: [
    'manage_business', 'manage_vans', 'manage_menu', 'manage_stock', 'stocktake',
    'record_wastage', 'manage_suppliers', 'manage_purchase_orders', 'manage_staff',
    'manage_shifts', 'manage_vehicles', 'manage_hygiene', 'use_pos', 'view_orders',
    'manage_orders', 'view_analytics',
  ],
  // Runs the operational side of the van(s) they're assigned to.
  VAN_MANAGER: [
    'manage_vans', 'manage_menu', 'manage_stock', 'stocktake', 'record_wastage',
    'manage_suppliers', 'manage_purchase_orders', 'manage_shifts', 'manage_vehicles',
    'manage_hygiene', 'use_pos', 'view_orders', 'manage_orders', 'view_analytics',
  ],
  DRIVER: ['use_pos', 'view_orders', 'record_wastage', 'stocktake'],
  STAFF: ['use_pos', 'view_orders'],
}

export function permissionsForRole(role: BusinessRole | null | undefined): Permission[] {
  if (role === 'OWNER') return [...PERMISSIONS]
  if (!role) return []
  return ROLE_PERMISSIONS[role] ?? []
}

export function hasPermission(role: BusinessRole | null | undefined, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission)
}

// staff.role is stored lowercase (user_role enum: business_admin, van_manager,
// driver, staff). This is the one place that mapping happens.
export function staffRoleToBusinessRole(staffRole: string): BusinessRole | null {
  const map: Record<string, BusinessRole> = {
    business_admin: 'BUSINESS_ADMIN',
    van_manager: 'VAN_MANAGER',
    driver: 'DRIVER',
    staff: 'STAFF',
  }
  return map[staffRole] ?? null
}

export function businessRoleToStaffRole(role: BusinessRole): string | null {
  const map: Record<string, string> = {
    BUSINESS_ADMIN: 'business_admin', VAN_MANAGER: 'van_manager', DRIVER: 'driver', STAFF: 'staff',
  }
  return map[role] ?? null
}
