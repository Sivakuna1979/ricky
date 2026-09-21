// @ts-nocheck
// Central automation type registry (D1/D2/D26/D27) — every automation
// FoodTaxi runs is listed here once, with its label, category, and
// conservative defaults. Nothing sends external messages unless a business
// has explicitly enabled that channel — see DEFAULT_CHANNELS below.

export type AutomationType =
  | 'low_stock' | 'out_of_stock' | 'draft_po_on_low_stock'
  | 'hygiene_missed'
  | 'vehicle_reminder' | 'equipment_reminder'
  | 'staff_unassigned_shift' | 'staff_late_clockin' | 'staff_missing_clockout'
  | 'daily_briefing' | 'end_of_day_summary' | 'weekly_summary'
  | 'marketing_suggestion'
  | 'event_tomorrow'
  | 'end_of_route_review'
  | 'invoice_due_reminder' | 'finance_review_digest' | 'vat_period_reminder' | 'daily_finance_summary'
  | 'promo_expiring' | 'feedback_request'
  | 'integration_sync_issue'

export const DEFAULT_IN_APP_ONLY = { in_app: true, email: false, sms: false, whatsapp: false }
export const DEFAULT_IN_APP_EMAIL = { in_app: true, email: true, sms: false, whatsapp: false }

// Conservative by design (D7): only the things an owner would clearly want
// on immediately are enabled by default; reports and suggestions are
// opt-in so nobody's inbox fills up without asking first.
export const AUTOMATIONS: Record<AutomationType, {
  label: string
  description: string
  category: 'stock' | 'hygiene' | 'vehicle' | 'staff' | 'reports' | 'marketing' | 'events'
  defaultEnabled: boolean
  defaultChannels: typeof DEFAULT_IN_APP_ONLY
  permission: string // lib/permissions.ts Permission this automation's data belongs to
}> = {
  low_stock:              { label: 'Low stock alerts',        description: 'Alert when a stock item falls to or below its minimum quantity.', category: 'stock',     defaultEnabled: true,  defaultChannels: DEFAULT_IN_APP_ONLY,  permission: 'manage_stock' },
  out_of_stock:           { label: 'Out of stock alerts',      description: 'Alert when a stock item reaches zero.',                            category: 'stock',     defaultEnabled: true,  defaultChannels: DEFAULT_IN_APP_ONLY,  permission: 'manage_stock' },
  draft_po_on_low_stock:  { label: 'Auto-draft purchase orders', description: 'Create a DRAFT purchase order (never sent) when stock is low, if a preferred supplier is set. You always review and confirm before it goes anywhere.', category: 'stock', defaultEnabled: false, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'manage_purchase_orders' },
  hygiene_missed:         { label: 'Missed hygiene checks',    description: 'Alert when an opening/closing checklist has not been completed.', category: 'hygiene',   defaultEnabled: true,  defaultChannels: DEFAULT_IN_APP_ONLY,  permission: 'manage_hygiene' },
  vehicle_reminder:       { label: 'MOT / insurance / tax / service reminders', description: 'Alert at 30/14/7/1 days before a vehicle renewal is due, and if overdue.', category: 'vehicle', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_EMAIL, permission: 'manage_vehicles' },
  equipment_reminder:     { label: 'Equipment service / warranty reminders', description: 'Alert when equipment service or warranty is due soon.', category: 'vehicle', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'manage_vehicles' },
  staff_unassigned_shift: { label: 'Unassigned shifts',        description: "Alert when tomorrow's scheduled van has no staff shift assigned.", category: 'staff',     defaultEnabled: true,  defaultChannels: DEFAULT_IN_APP_ONLY,  permission: 'manage_shifts' },
  staff_late_clockin:     { label: 'Late clock-in',            description: 'Alert when a scheduled shift has started and the staff member has not clocked in.', category: 'staff', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'manage_shifts' },
  staff_missing_clockout: { label: 'Missing clock-out',        description: 'Alert when someone has been clocked in for an unusually long time.', category: 'staff', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'manage_shifts' },
  daily_briefing:         { label: 'Daily briefing',           description: "A morning summary of today's vans, staff, stock, hygiene, vehicle and event items.", category: 'reports', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_analytics' },
  end_of_day_summary:     { label: 'End-of-day summary',       description: "Today's revenue, orders, top sellers, wastage and hours.", category: 'reports', defaultEnabled: false, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_analytics' },
  weekly_summary:         { label: 'Weekly summary',           description: 'Revenue, orders and operational comparison vs the previous week.', category: 'reports', defaultEnabled: false, defaultChannels: DEFAULT_IN_APP_EMAIL, permission: 'view_analytics' },
  marketing_suggestion:   { label: 'Marketing suggestions',    description: 'Suggested (not sent) campaigns, e.g. lapsed regular customers.', category: 'marketing', defaultEnabled: false, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_analytics' },
  event_tomorrow:         { label: 'Event tomorrow',           description: 'A preparation reminder the day before your confirmed event.', category: 'events', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_orders' },
  end_of_route_review:    { label: 'End-of-route review',      description: "A summary sent when a route session is ended: revenue, orders and how it compared to recent same-weekday trading (G55).", category: 'reports', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_analytics' },
  // Phase H — finance automations.
  invoice_due_reminder:   { label: 'Supplier invoice due/overdue', description: 'Alert at 7/1 days before a supplier invoice is due, and if overdue.', category: 'reports', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_expenses' },
  finance_review_digest:  { label: 'Finance review queue digest', description: 'A daily alert when there are open items in the finance review queue (duplicates, unknown VAT, variances, mismatches).', category: 'reports', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_finance_summary' },
  vat_period_reminder:    { label: 'VAT period reminder',      description: "A monthly reminder to review last month's recorded VAT summary, for VAT-registered businesses.", category: 'reports', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_vat' },
  daily_finance_summary:  { label: 'Daily finance summary',    description: "Yesterday's net revenue, expenses and gross contribution.", category: 'reports', defaultEnabled: false, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_finance_summary' },
  // Phase I — CRM/loyalty/marketing automations.
  promo_expiring:  { label: 'Promo code expiring',   description: 'Alert 3 days before an active promo code ends.', category: 'marketing', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'manage_promotions' },
  feedback_request: { label: 'Feedback request',      description: 'Ask a customer to rate their order by email, once, a few hours after collection.', category: 'marketing', defaultEnabled: false, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'manage_reviews' },
  // Phase L — payments/accounting integration health.
  integration_sync_issue: { label: 'Integration sync issues', description: 'A daily digest when accounting sync jobs fail/need review, or a payment/accounting connection has an error.', category: 'reports', defaultEnabled: true, defaultChannels: DEFAULT_IN_APP_ONLY, permission: 'view_integrations' },
}

export const AUTOMATION_TYPE_LIST = Object.keys(AUTOMATIONS) as AutomationType[]
