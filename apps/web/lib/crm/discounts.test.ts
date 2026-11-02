import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateDiscountCode } from '@/lib/crm/discounts'

// A chainable Supabase-query-builder stand-in: every chain method returns
// itself, and the chain is awaitable from any point (table-select-eq-eq, or
// table-select-eq-eq-maybeSingle) because it resolves itself via `then`.
// `responses` maps table name -> a single result or a queue of results
// (consumed in call order) for tables hit more than once per test.
function createAdminMock(responses: Record<string, any>) {
  const queues: Record<string, any[]> = {}
  for (const [table, val] of Object.entries(responses)) {
    queues[table] = Array.isArray(val) ? [...val] : [val]
  }
  const from = vi.fn((table: string) => {
    const queue = queues[table] ?? [{ data: null }]
    const result = queue.length > 1 ? queue.shift() : queue[0]
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () => Promise.resolve(result),
      then: (resolve: any) => resolve(result),
    }
    return chain
  })
  return { from } as any
}

const baseCtx = { vanId: 'van1', channel: 'pos', subtotal: 20, crmCustomerId: null, isNewCustomer: false }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('validateDiscountCode', () => {
  it('rejects an empty/whitespace-only code without querying anything', async () => {
    const admin = createAdminMock({})
    const result = await validateDiscountCode(admin, 'biz1', '   ', baseCtx)
    expect(result).toEqual({ valid: false, reason: 'no_code' })
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('returns not_found when neither a promo code nor a voucher matches', async () => {
    const admin = createAdminMock({ promo_codes: { data: null }, vouchers: { data: null } })
    const result = await validateDiscountCode(admin, 'biz1', 'NOPE', baseCtx)
    expect(result).toEqual({ valid: false, reason: 'not_found' })
  })

  it('normalises the code to uppercase/trimmed before matching (case-insensitive)', async () => {
    const admin = createAdminMock({
      promo_codes: { data: { id: 'p1', is_active: true, discount_type: 'fixed', discount_value: 5 } },
    })
    const result = await validateDiscountCode(admin, 'biz1', '  save5  ', baseCtx)
    expect(result.valid).toBe(true)
  })

  describe('promo codes', () => {
    it('rejects an inactive promo', async () => {
      const admin = createAdminMock({ promo_codes: { data: { id: 'p1', is_active: false } } })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE5', baseCtx)
      expect(result).toEqual({ valid: false, reason: 'inactive' })
    })

    it('rejects a promo that has not started yet', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, starts_at: '2026-07-01T00:00:00Z' } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE5', baseCtx)
      expect(result).toEqual({ valid: false, reason: 'not_started' })
    })

    it('rejects an expired promo', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, ends_at: '2026-06-01T00:00:00Z' } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE5', baseCtx)
      expect(result).toEqual({ valid: false, reason: 'expired' })
    })

    it('rejects an order below the minimum spend and reports the required minimum', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, min_spend: 50 } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE5', baseCtx)
      expect(result).toEqual({ valid: false, reason: 'below_minimum_spend', min_spend: 50 })
    })

    it('rejects when the current van is not in the eligible list', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, eligible_van_ids: ['other-van'] } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE5', baseCtx)
      expect(result).toEqual({ valid: false, reason: 'wrong_van' })
    })

    it('rejects when the order channel is not in the eligible list', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, eligible_channels: ['online'] } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE5', baseCtx)
      expect(result).toEqual({ valid: false, reason: 'wrong_channel' })
    })

    it('rejects a new-customers-only promo for a returning customer', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, new_customers_only: true } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE5', { ...baseCtx, isNewCustomer: false })
      expect(result).toEqual({ valid: false, reason: 'new_customers_only' })
    })

    it('rejects once the global redemption limit is reached', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, max_redemptions: 10 } },
        promo_redemptions: { count: 10 },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE5', baseCtx)
      expect(result).toEqual({ valid: false, reason: 'redemption_limit_reached' })
    })

    it('rejects once this customer has hit their per-customer limit', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, per_customer_limit: 1 } },
        promo_redemptions: { count: 1 },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE5', { ...baseCtx, crmCustomerId: 'cust1' })
      expect(result).toEqual({ valid: false, reason: 'per_customer_limit_reached' })
    })

    it('accepts a valid percentage promo and computes the discount off the given subtotal', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, discount_type: 'percentage', discount_value: 10, description: '10% off' } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'SAVE10', { ...baseCtx, subtotal: 20 })
      expect(result).toEqual({ valid: true, kind: 'promo', id: 'p1', discount_amount: 2, description: '10% off' })
    })

    it('clamps a fixed-amount promo so the discount never exceeds the subtotal', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: true, discount_type: 'fixed', discount_value: 999 } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'BIG', { ...baseCtx, subtotal: 15 })
      expect(result.discount_amount).toBe(15)
    })

    it('never falls through to check vouchers once a promo code row is matched', async () => {
      const admin = createAdminMock({
        promo_codes: { data: { id: 'p1', is_active: false } },
        vouchers: { data: { id: 'v1', status: 'ACTIVE' } },
      })
      await validateDiscountCode(admin, 'biz1', 'DUPLICATECODE', baseCtx)
      expect(admin.from).not.toHaveBeenCalledWith('vouchers')
    })
  })

  describe('vouchers', () => {
    it('rejects a voucher that is not ACTIVE', async () => {
      const admin = createAdminMock({ promo_codes: { data: null }, vouchers: { data: { id: 'v1', status: 'REDEEMED' } } })
      const result = await validateDiscountCode(admin, 'biz1', 'GIFT1', baseCtx)
      expect(result).toEqual({ valid: false, reason: 'not_active' })
    })

    it('rejects an expired voucher', async () => {
      const admin = createAdminMock({
        promo_codes: { data: null },
        vouchers: { data: { id: 'v1', status: 'ACTIVE', expires_at: '2026-01-01T00:00:00Z' } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'GIFT1', baseCtx)
      expect(result).toEqual({ valid: false, reason: 'expired' })
    })

    it('rejects a voucher intended for a different customer', async () => {
      const admin = createAdminMock({
        promo_codes: { data: null },
        vouchers: { data: { id: 'v1', status: 'ACTIVE', intended_customer_id: 'someone-else' } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'GIFT1', { ...baseCtx, crmCustomerId: 'cust1' })
      expect(result).toEqual({ valid: false, reason: 'not_your_voucher' })
    })

    it('accepts a valid voucher and computes its discount', async () => {
      const admin = createAdminMock({
        promo_codes: { data: null },
        vouchers: { data: { id: 'v1', status: 'ACTIVE', discount_type: 'fixed', discount_value: 5 } },
      })
      const result = await validateDiscountCode(admin, 'biz1', 'GIFT1', { ...baseCtx, subtotal: 20 })
      expect(result).toEqual({ valid: true, kind: 'voucher', id: 'v1', discount_amount: 5, description: 'Voucher' })
    })
  })
})
