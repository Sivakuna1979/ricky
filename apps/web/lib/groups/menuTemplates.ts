// @ts-nocheck
// M22/M23/M56/M57 — applying a published template version to a business's
// LIVE menu. Never touches an item the business itself created (matched
// only by `menu_items.group_template_item_id`, never by name) and never
// overwrites a previously-applied item's fields unless the template's own
// policy explicitly says so:
//   - template.policy === 'GROUP_LOCKED': every re-apply fully syncs name/
//     description/allergens/image/price for every item.
//   - item.price_policy === 'REQUIRED' (regardless of template policy):
//     price specifically is always synced on re-apply.
//   - otherwise: an already-applied item is left completely untouched —
//     the business is presumed to have customised it, and price_policy
//     'RECOMMENDED'/'BUSINESS_CONTROLLED' both mean "never overwrite".
// A brand-new item (never applied before) is always created with the
// template's values, including its recommended price as a starting point.
import { round2 } from '@/lib/finance/money'

export async function applyMenuTemplateToBusiness(admin: any, params: { applicationId: string; businessId: string; userId: string }) {
  const { data: application } = await admin.from('group_menu_template_applications').select('*, group_menu_templates(*)').eq('id', params.applicationId).maybeSingle()
  if (!application || application.business_id !== params.businessId) throw Object.assign(new Error('not_found'), { statusCode: 404 })
  if (application.status !== 'PENDING') throw Object.assign(new Error(`This proposal is already ${application.status.toLowerCase()}.`), { statusCode: 409 })

  const { data: version } = await admin.from('group_menu_template_versions').select('*').eq('id', application.version_id).maybeSingle()
  if (!version) throw Object.assign(new Error('Template version not found.'), { statusCode: 404 })
  const templatePolicy = application.group_menu_templates?.policy ?? 'GROUP_DEFAULT_BUSINESS_CAN_OVERRIDE'
  const snapshotItems: any[] = version.snapshot ?? []

  const { data: vans } = await admin.from('vans').select('id').eq('business_id', params.businessId).eq('is_active', true)
  if (!vans?.length) throw Object.assign(new Error('This business has no active vans to apply a menu to.'), { statusCode: 409 })

  let created = 0, updated = 0, skipped = 0

  for (const van of vans) {
    const { data: menu } = await admin.from('menus').select('id').eq('van_id', van.id).eq('is_active', true).limit(1).maybeSingle()
    if (!menu) { skipped += snapshotItems.length; continue }

    for (const item of snapshotItems) {
      let { data: category } = await admin.from('menu_categories').select('id').eq('menu_id', menu.id).ilike('name', item.category).maybeSingle()
      if (!category) {
        const { data: newCategory } = await admin.from('menu_categories').insert({ menu_id: menu.id, name: item.category }).select('id').single()
        category = newCategory
      }
      if (!category) { skipped++; continue }

      const { data: existingItem } = await admin.from('menu_items').select('id').eq('category_id', category.id).eq('group_template_item_id', item.id).maybeSingle()

      if (!existingItem) {
        await admin.from('menu_items').insert({
          category_id: category.id, name: item.name, description: item.description ?? null,
          price: item.recommended_price != null ? round2(item.recommended_price) : 0,
          allergens: item.allergens ?? null, image_url: item.image_url ?? null,
          group_template_item_id: item.id, group_template_version_applied: version.version_number,
        })
        created++
        continue
      }

      const fullSync = templatePolicy === 'GROUP_LOCKED'
      const priceSync = fullSync || item.price_policy === 'REQUIRED'
      if (!fullSync && !priceSync) { skipped++; continue }

      const patch: any = { group_template_version_applied: version.version_number }
      if (fullSync) { patch.name = item.name; patch.description = item.description ?? null; patch.allergens = item.allergens ?? null; patch.image_url = item.image_url ?? null }
      if (priceSync && item.recommended_price != null) patch.price = round2(item.recommended_price)
      await admin.from('menu_items').update(patch).eq('id', existingItem.id)
      updated++
    }
  }

  const result = { items_created: created, items_updated: updated, items_skipped_local_edit: skipped }
  await admin.from('group_menu_template_applications').update({ status: 'APPLIED', applied_by: params.userId, applied_at: new Date().toISOString(), result }).eq('id', application.id)
  return result
}
