// @ts-nocheck
// L36/L37 — the ONE place a category is resolved to a real external
// account/tax code before a sync job is allowed to push anything. Never
// guesses: a missing mapping throws, which the sync engine turns into a
// NEEDS_REVIEW job rather than a guessed submission. Explicitly not tax
// advice (L37) — this only resolves whatever a human already configured on
// the mapping screen (app/(business)/dashboard/integrations), it never
// suggests or infers a tax treatment.
export class MappingRequiredError extends Error {
  constructor(public category: string, public provider: string) {
    super(`mapping_required:${provider}:${category}`)
  }
}

export async function requireAccountMapping(admin: any, businessId: string, provider: string, category: string) {
  const { data } = await admin.from('accounting_account_mappings').select('*').eq('business_id', businessId).eq('provider', provider).eq('category', category).maybeSingle()
  if (!data || !data.external_account_id) throw new MappingRequiredError(category, provider)
  return data
}

export async function listAccountMappings(admin: any, businessId: string, provider: string) {
  const { data } = await admin.from('accounting_account_mappings').select('*').eq('business_id', businessId).eq('provider', provider)
  return data ?? []
}
