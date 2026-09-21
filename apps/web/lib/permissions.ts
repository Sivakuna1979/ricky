// @ts-nocheck
// Central Phase C permissions architecture (C17) — the one place role →
// permission mappings live, instead of `if (role === ...)` scattered across
// routes. SUPER_ADMIN is platform-level and handled entirely by
// lib/isSuperAdmin.ts — it is intentionally not part of this business-role
// model at all.

// H58/H59 — ACCOUNTANT is finance-scoped only: it gets no automatic
// operational-admin rights (manage_stock, manage_staff, manage_vans,
// use_pos, ...), only the new finance permissions below.
export const BUSINESS_ROLES = ['OWNER', 'BUSINESS_ADMIN', 'VAN_MANAGER', 'DRIVER', 'STAFF', 'ACCOUNTANT'] as const
export type BusinessRole = typeof BUSINESS_ROLES[number]

export const PERMISSIONS = [
  'manage_business', 'manage_vans', 'manage_menu', 'manage_stock', 'stocktake',
  'record_wastage', 'manage_suppliers', 'manage_purchase_orders', 'manage_staff',
  'manage_shifts', 'manage_vehicles', 'manage_hygiene', 'use_pos', 'view_orders',
  'manage_orders', 'view_analytics', 'manage_billing', 'manage_business_memory',
  // Phase H (H58/H59) — finance permissions, deliberately granular so a
  // business can hand an accountant/bookkeeper exactly the finance
  // surface without any operational access.
  'view_finance_summary', 'view_sales_finance', 'view_expenses', 'create_expense',
  'approve_expense', 'manage_supplier_invoices', 'record_supplier_payment',
  'perform_cash_count', 'view_cash_variance', 'view_vat', 'edit_vat',
  'export_finance', 'manage_finance_settings',
  // Phase I (I67) — CRM/loyalty/marketing permissions, deliberately
  // granular: contact info, loyalty adjustment and bulk campaign send
  // are each their own grant, not lumped into a single "CRM access".
  'view_customers', 'view_customer_contact', 'manage_customer_notes',
  'manage_loyalty', 'adjust_loyalty', 'manage_promotions', 'manage_campaigns',
  'send_campaigns', 'view_marketing_analytics', 'manage_reviews', 'manage_crm_settings',
  // Phase K (K60/K61) — Command Centre permissions, deliberately granular
  // like every phase before it: seeing the command centre at all is
  // separate from seeing business-wide (vs van-scoped) intelligence,
  // separate again from finance/customer/stock intelligence specifically,
  // separate again from setting goals or using the AI owner-brief tools.
  'view_command_centre', 'view_business_intelligence', 'view_finance_intelligence',
  'view_customer_intelligence', 'view_stock_intelligence', 'manage_business_goals',
  'use_ai_owner_brief',
] as const
export type Permission = typeof PERMISSIONS[number]

// OWNER always has every permission — this is not just "a role with lots of
// grants", it's the actual business owner (businesses.owner_id), so it can
// never be locked out of its own business regardless of what's listed here.
const ROLE_PERMISSIONS: Record<Exclude<BusinessRole, 'OWNER'>, Permission[]> = {
  // Everything but billing — a trusted manager runs the business day to
  // day, but the paying account stays with the owner by default. Full
  // finance access too (H58 — a "trusted manager" naturally includes
  // running the books, not just operations).
  BUSINESS_ADMIN: [
    'manage_business', 'manage_vans', 'manage_menu', 'manage_stock', 'stocktake',
    'record_wastage', 'manage_suppliers', 'manage_purchase_orders', 'manage_staff',
    'manage_shifts', 'manage_vehicles', 'manage_hygiene', 'use_pos', 'view_orders',
    'manage_orders', 'view_analytics', 'manage_business_memory',
    'view_finance_summary', 'view_sales_finance', 'view_expenses', 'create_expense',
    'approve_expense', 'manage_supplier_invoices', 'record_supplier_payment',
    'perform_cash_count', 'view_cash_variance', 'view_vat', 'edit_vat',
    'export_finance', 'manage_finance_settings',
    'view_customers', 'view_customer_contact', 'manage_customer_notes',
    'manage_loyalty', 'adjust_loyalty', 'manage_promotions', 'manage_campaigns',
    'send_campaigns', 'view_marketing_analytics', 'manage_reviews', 'manage_crm_settings',
    // K60 — a trusted manager gets the full business-wide command centre,
    // same reasoning as their full finance/CRM access above.
    'view_command_centre', 'view_business_intelligence', 'view_finance_intelligence',
    'view_customer_intelligence', 'view_stock_intelligence', 'manage_business_goals',
    'use_ai_owner_brief',
  ],
  // Runs the operational side of the van(s) they're assigned to — enough
  // finance access to log a cash count and an expense at their own van,
  // not to approve/pay suppliers, touch VAT, or export (H59 — "ordinary
  // staff minimal finance access by default"). Same idea for CRM (I67):
  // enough to look up a customer and run POS loyalty day to day, not to
  // adjust balances by hand or manage/send bulk marketing.
  VAN_MANAGER: [
    'manage_vans', 'manage_menu', 'manage_stock', 'stocktake', 'record_wastage',
    'manage_suppliers', 'manage_purchase_orders', 'manage_shifts', 'manage_vehicles',
    'manage_hygiene', 'use_pos', 'view_orders', 'manage_orders', 'view_analytics',
    'manage_business_memory',
    'view_finance_summary', 'view_expenses', 'create_expense', 'perform_cash_count', 'view_cash_variance',
    'view_customers', 'view_customer_contact', 'manage_customer_notes', 'manage_loyalty', 'manage_reviews',
    // K60 — sees the command centre for their own assigned van(s) only
    // (enforced by staffContext.vanIds in the API layer, same as every
    // other Van Manager grant above); no goal-setting and no AI
    // owner-brief (that's framed as whole-business decision support).
    'view_command_centre', 'view_business_intelligence', 'view_finance_intelligence',
    'view_customer_intelligence', 'view_stock_intelligence',
  ],
  // Business memory notes are deliberately low-stakes (operational
  // observations, not financial/destructive actions), so every active
  // role — including DRIVER/STAFF — can add one: they're the people
  // actually on the road who'd note "sold out of cod" or "road closed".
  // Same reasoning extends to a basic cash count and logging a receipt.
  // manage_loyalty (not view_customers) is what lets them run POS
  // loyalty lookup/redemption without any access to the customer list or
  // bulk contact data (I67 — "should not automatically access the full
  // customer database").
  DRIVER: ['use_pos', 'view_orders', 'record_wastage', 'stocktake', 'manage_business_memory', 'perform_cash_count', 'create_expense', 'manage_loyalty'],
  STAFF: ['use_pos', 'view_orders', 'manage_business_memory', 'perform_cash_count', 'create_expense', 'manage_loyalty'],
  // H58 — finance-scoped only. No operational permissions at all: an
  // accountant/bookkeeper can see and manage the books without being
  // able to touch stock, staff, vans, or POS.
  ACCOUNTANT: [
    'view_finance_summary', 'view_sales_finance', 'view_expenses', 'create_expense',
    'approve_expense', 'manage_supplier_invoices', 'record_supplier_payment',
    'view_cash_variance', 'view_vat', 'edit_vat', 'export_finance',
    'manage_finance_settings', 'manage_business_memory',
    // K60 — finance-scoped only, same as every other Accountant grant.
    'view_finance_intelligence', 'use_ai_owner_brief',
  ],
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
// driver, staff, accountant). This is the one place that mapping happens.
export function staffRoleToBusinessRole(staffRole: string): BusinessRole | null {
  const map: Record<string, BusinessRole> = {
    business_admin: 'BUSINESS_ADMIN',
    van_manager: 'VAN_MANAGER',
    driver: 'DRIVER',
    staff: 'STAFF',
    accountant: 'ACCOUNTANT',
  }
  return map[staffRole] ?? null
}

export function businessRoleToStaffRole(role: BusinessRole): string | null {
  const map: Record<string, string> = {
    BUSINESS_ADMIN: 'business_admin', VAN_MANAGER: 'van_manager', DRIVER: 'driver', STAFF: 'staff', ACCOUNTANT: 'accountant',
  }
  return map[role] ?? null
}
