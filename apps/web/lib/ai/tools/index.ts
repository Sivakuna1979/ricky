// @ts-nocheck
// The complete approved tool registry (E5, E6) — this and only this is
// what FoodTaxi AI can ever touch. Every handler receives the
// server-resolved AiContext (never anything the model or browser supplied
// for business_id/permissions) and the service-role admin client; each
// handler is responsible for scoping its own queries to ctx.businessId
// (and ctx.vanIds where van-level access matters — see lib/ai/context.ts).
import { salesTools } from './sales'
import { stockTools } from './stock'
import { supplierTools } from './suppliers'
import { staffTools } from './staff'
import { hygieneTools } from './hygiene'
import { vehicleTools } from './vehicles'
import { eventTools } from './events'
import { operationsTools } from './operations'
import { actionTools } from './actions'
import { memoryTools } from './memory'
import { routeTools } from './routes'
import { financeTools } from './finance'
import { crmTools } from './crm'
import { ownerIntelligenceTools } from './ownerIntelligence'
import { integrationsTools } from './integrations'

export const ALL_TOOLS = [
  ...salesTools, ...stockTools, ...supplierTools, ...staffTools, ...hygieneTools,
  ...vehicleTools, ...eventTools, ...operationsTools, ...actionTools, ...memoryTools,
  ...routeTools, ...financeTools, ...crmTools, ...ownerIntelligenceTools, ...integrationsTools,
]

export const TOOLS_BY_NAME = Object.fromEntries(ALL_TOOLS.map(t => [t.name, t]))

// What Claude actually receives — name/description/input_schema only.
// Handlers stay server-side and are never serialised or exposed.
export function claudeToolDefinitions() {
  return ALL_TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
}

// L58 — propose_provider_refund joins this list for the exact same reason
// as every other propose_* tool: the UI shows it as a DRAFT requiring an
// explicit Confirm click, never something the model's own text output can
// be mistaken for having already done.
export const WRITE_TOOL_NAMES = new Set(['propose_purchase_order', 'propose_stock_transfer', 'propose_expense', 'propose_campaign', 'propose_provider_refund'])
