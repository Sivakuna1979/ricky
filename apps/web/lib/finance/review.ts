// @ts-nocheck
// H54 — the finance review queue. A single generic table
// (finance_review_items) rather than one table per reason; this is the
// one place a row gets added to it, so every reason stays consistent.
export async function flagForReview(admin: any, businessId: string, itemType: string, relatedTable: string | null, relatedId: string | null, detail: Record<string, any>) {
  await admin.from('finance_review_items').insert({
    business_id: businessId, item_type: itemType, related_table: relatedTable, related_id: relatedId, detail,
  })
}

export async function getReviewQueue(admin: any, businessId: string, status = 'OPEN') {
  const { data } = await admin.from('finance_review_items').select('*').eq('business_id', businessId).eq('status', status).order('created_at', { ascending: false })
  return data ?? []
}

export async function resolveReviewItem(admin: any, businessId: string, id: string, userId: string, status: 'RESOLVED' | 'DISMISSED') {
  const { data } = await admin.from('finance_review_items').update({ status, resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq('id', id).eq('business_id', businessId).eq('status', 'OPEN').select().maybeSingle()
  return data
}
