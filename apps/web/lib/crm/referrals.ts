// @ts-nocheck
// I24/I25 — referral programme. Idempotent and business-scoped:
// referral_conversions.qualifying_order_id is UNIQUE, so a given order
// can only ever qualify a referral once, however many times this is
// called for it (retries, duplicate webhook, etc).
import { findOrCreateCrmCustomer } from './identity'

export async function getReferralSettings(admin: any, businessId: string) {
  const { data } = await admin.from('referral_settings').select('*').eq('business_id', businessId).maybeSingle()
  return data ?? { business_id: businessId, enabled: false, referrer_reward_type: 'fixed_amount', referrer_reward_value: 5, reward_new_customer: true, referred_reward_type: 'fixed_amount', referred_reward_value: 5 }
}

export async function getOrCreateReferralCode(admin: any, businessId: string, crmCustomerId: string) {
  const { data: existing } = await admin.from('referral_codes').select('*').eq('crm_customer_id', crmCustomerId).maybeSingle()
  if (existing) return existing
  const code = `FTR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const { data, error } = await admin.from('referral_codes').insert({ business_id: businessId, crm_customer_id: crmCustomerId, code }).select().single()
  if (error) {
    if (error.code === '23505') { const { data: raceWinner } = await admin.from('referral_codes').select('*').eq('crm_customer_id', crmCustomerId).maybeSingle(); return raceWinner }
    throw error
  }
  return data
}

async function mintVoucher(admin: any, businessId: string, crmCustomerId: string, type: string, value: number, source: string) {
  const code = `FTV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  const { data } = await admin.from('vouchers').insert({
    business_id: businessId, code, discount_type: type, discount_value: value, source, intended_customer_id: crmCustomerId,
  }).select().single()
  return data
}

// I24/I25 — called when a NEW customer's qualifying first order is
// collected. Prevents self-referral by comparing identity, not name
// (I3/I24): a referrer cannot qualify against their own phone/email.
// Never rewards for a click — only a completed qualifying order (I24).
export async function qualifyReferral(admin: any, businessId: string, referralCode: string, referredOrder: { id: string; guest_phone: string | null; guest_email: string | null; guest_name: string | null; customer_id: string | null }) {
  const settings = await getReferralSettings(admin, businessId)
  if (!settings.enabled) return null

  const { data: code } = await admin.from('referral_codes').select('*, crm_customers(id, identity_key)').eq('business_id', businessId).eq('code', referralCode.trim().toUpperCase()).maybeSingle()
  if (!code) return null

  const referred = await findOrCreateCrmCustomer(admin, businessId, { phone: referredOrder.guest_phone, email: referredOrder.guest_email, displayName: referredOrder.guest_name, customerId: referredOrder.customer_id })
  if (!referred) return null
  if (referred.identity_key === code.crm_customers?.identity_key) return null // self-referral

  const { data: existingConversion } = await admin.from('referral_conversions').select('id').eq('qualifying_order_id', referredOrder.id).maybeSingle()
  if (existingConversion) return null // already qualified (idempotent)

  // Only a genuinely first order counts as "qualifying" (I24).
  const { count: priorOrders } = await admin.from('orders').select('id', { count: 'exact', head: true })
    .neq('id', referredOrder.id).eq('status', 'collected')
    .or(referredOrder.guest_phone ? `guest_phone.eq.${referredOrder.guest_phone}` : `guest_email.eq.${referredOrder.guest_email}`)
  if ((priorOrders ?? 0) > 0) return null

  const referrerVoucher = await mintVoucher(admin, businessId, code.crm_customer_id, settings.referrer_reward_type, settings.referrer_reward_value, 'referral_reward')
  const referredVoucher = settings.reward_new_customer
    ? await mintVoucher(admin, businessId, referred.id, settings.referred_reward_type, settings.referred_reward_value, 'referral_reward')
    : null

  const { data: conversion, error } = await admin.from('referral_conversions').insert({
    business_id: businessId, referral_code_id: code.id, referred_crm_customer_id: referred.id, qualifying_order_id: referredOrder.id,
    referrer_voucher_id: referrerVoucher?.id ?? null, referred_voucher_id: referredVoucher?.id ?? null, status: 'REWARDED',
  }).select().single()
  if (error) return null // duplicate under a race — the UNIQUE constraint already guarded this
  return conversion
}
