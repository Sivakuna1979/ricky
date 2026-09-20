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

export const ALL_TOOLS = [
  ...salesTools, ...stockTools, ...supplierTools, ...staffTools, ...hygieneTools,
  ...vehicleTools, ...eventTools, ...operationsTools, ...actionTools, ...memoryTools,
]

export const TOOLS_BY_NAME = Object.fromEntries(ALL_TOOLS.map(t => [t.name, t]))

// What Claude actually receives — name/description/input_schema only.
// Handlers stay server-side and are never serialised or exposed.
export function claudeToolDefinitions() {
  return ALL_TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
}

export const WRITE_TOOL_NAMES = new Set(['propose_purchase_order'])
