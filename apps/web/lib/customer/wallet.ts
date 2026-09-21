// @ts-nocheck
// J43/J44/J45 — composes the customer-facing loyalty/rewards/referral
// wallet at read time from Phase I's existing tables. Nothing here is a
// second copy of Phase I data: balances come straight from
// loyalty_accounts.balance (the one cached value Phase I's own
// apply_loyalty_transaction() maintains), vouchers/referrals are read
// as-is. Business-internal rules (points_per_pound, promo eligibility
// logic, etc.) are never surfaced — only what a customer needs to see.
export async function getCustomerWallet(admin: any, customerId: string) {
  const { data: crmRows } = await admin
    .from('crm_customers')
    .select('id, business_id, businesses(name)')
    .eq('customer_id', customerId)
  const rows = crmRows ?? []
  if (!rows.length) return { loyalty: [], vouchers: [], referrals: [] }

  const crmIds = rows.map((r: any) => r.id)
  const bizName = Object.fromEntries(rows.map((r: any) => [r.business_id, r.businesses?.name ?? 'FoodTaxi business']))

  const [{ data: loyaltyAccounts }, { data: settingsRows }, { data: vouchers }, { data: referralCodes }] = await Promise.all([
    admin.from('loyalty_accounts').select('id, business_id, balance, crm_customer_id').in('crm_customer_id', crmIds),
    admin.from('loyalty_settings').select('business_id, enabled, programme_name, reward_threshold, reward_description, earning_method').in('business_id', rows.map((r: any) => r.business_id)),
    admin.from('vouchers').select('id, business_id, code, discount_type, discount_value, status, source, expires_at, issued_at').in('intended_customer_id', crmIds).eq('status', 'ACTIVE'),
    admin.from('referral_codes').select('id, business_id, code, crm_customer_id').in('crm_customer_id', crmIds),
  ])

  const settingsByBiz = Object.fromEntries((settingsRows ?? []).map((s: any) => [s.business_id, s]))
  const loyalty = (loyaltyAccounts ?? [])
    .filter((a: any) => settingsByBiz[a.business_id]?.enabled)
    .map((a: any) => ({
      business_id: a.business_id,
      business_name: bizName[a.business_id],
      balance: Number(a.balance),
      programme_name: settingsByBiz[a.business_id]?.programme_name,
      reward_threshold: Number(settingsByBiz[a.business_id]?.reward_threshold ?? 0),
      reward_description: settingsByBiz[a.business_id]?.reward_description,
      earning_method: settingsByBiz[a.business_id]?.earning_method,
    }))

  const voucherList = (vouchers ?? []).map((v: any) => ({
    id: v.id,
    business_id: v.business_id,
    business_name: bizName[v.business_id],
    code: v.code,
    discount_type: v.discount_type,
    discount_value: Number(v.discount_value),
    source: v.source,
    expires_at: v.expires_at,
  }))

  let referrals: any[] = []
  if (referralCodes?.length) {
    const codeIds = referralCodes.map((c: any) => c.id)
    const { data: conversions } = await admin.from('referral_conversions').select('referral_code_id, status').in('referral_code_id', codeIds)
    referrals = referralCodes.map((c: any) => {
      const mine = (conversions ?? []).filter((cv: any) => cv.referral_code_id === c.id)
      return {
        business_id: c.business_id,
        business_name: bizName[c.business_id],
        code: c.code,
        pending: mine.filter((m: any) => m.status === 'QUALIFIED').length,
        rewarded: mine.filter((m: any) => m.status === 'REWARDED').length,
      }
    })
  }

  return { loyalty, vouchers: voucherList, referrals }
}
