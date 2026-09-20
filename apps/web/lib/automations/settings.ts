// @ts-nocheck
import { AUTOMATIONS, AUTOMATION_TYPE_LIST, type AutomationType } from './types'

export type ResolvedSetting = {
  automation_type: AutomationType
  enabled: boolean
  channels: { in_app: boolean; email: boolean; sms: boolean; whatsapp: boolean }
  config: Record<string, any>
}

// Every business gets sensible defaults (lib/automations/types.ts) until it
// explicitly saves its own row — no migration-time seeding required, and a
// new automation type added later automatically gets a safe default for
// every existing business without a backfill.
export async function getResolvedSettings(admin: any, businessId: string): Promise<Record<AutomationType, ResolvedSetting>> {
  const { data: rows } = await admin.from('automation_settings').select('*').eq('business_id', businessId)
  const byType = Object.fromEntries((rows ?? []).map((r: any) => [r.automation_type, r]))

  const result: any = {}
  for (const type of AUTOMATION_TYPE_LIST) {
    const stored = byType[type]
    const def = AUTOMATIONS[type]
    result[type] = {
      automation_type: type,
      enabled: stored?.enabled ?? def.defaultEnabled,
      channels: stored?.channels ?? def.defaultChannels,
      config: stored?.config ?? {},
    }
  }
  return result
}

export async function getSingleSetting(admin: any, businessId: string, type: AutomationType): Promise<ResolvedSetting> {
  const all = await getResolvedSettings(admin, businessId)
  return all[type]
}
