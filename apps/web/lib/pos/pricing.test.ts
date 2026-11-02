import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computePosSale } from '@/lib/pos/pricing'
import { validateDiscountCode } from '@/lib/crm/discounts'
import { findOrCreateCrmCustomer } from '@/lib/crm/identity'

// pricing.ts only orchestrates these two — their own logic is covered by
// lib/crm/discounts.test.ts, so here we stub them and assert the math/wiring.
vi.mock('@/lib/crm/discounts', () => ({ validateDiscountCode: vi.fn() }))
vi.mock('@/lib/crm/identity', () => ({ findOrCreateCrmCustomer: vi.fn() }))

const admin = {} as any

const baseItems = [
  { menu_item_id: 'a', name: 'Burger', price: 5, quantity: 2, item_total: 10 },
  { menu_item_id: 'b', name: 'Fries', price: 3, quantity: 1, item_total: 3 },
]

beforeEach(() => {
  vi.mocked(validateDiscountCode).mockReset()
  vi.mocked(findOrCreateCrmCustomer).mockReset()
})

describe('computePosSale', () => {
  it('sums item_total for the subtotal and total when there is no discount', async () => {
    const result = await computePosSale(admin, { businessId: 'biz1', vanId: 'van1', items: baseItems })
    expect(result.subtotal).toBe(13)
    expect(result.totalDiscount).toBe(0)
    expect(result.total).toBe(13)
  })

  it('clamps a deal discount larger than the subtotal to the subtotal, never going negative', async () => {
    const result = await computePosSale(admin, {
      businessId: 'biz1', vanId: 'van1', items: baseItems, dealDiscountAmount: 999,
    })
    expect(result.totalDiscount).toBe(13)
    expect(result.total).toBe(0)
  })

  it('combines a deal discount with a valid promo code discount', async () => {
    vi.mocked(validateDiscountCode).mockResolvedValue({ valid: true, kind: 'promo', id: 'p1', discount_amount: 2, description: null })
    const result = await computePosSale(admin, {
      businessId: 'biz1', vanId: 'van1', items: baseItems, dealDiscountAmount: 3, discountCode: 'SAVE2',
    })
    expect(result.totalDiscount).toBe(5)
    expect(result.total).toBe(8)
  })

  it('throws a 400-tagged error when the discount code is not valid, before touching the total', async () => {
    vi.mocked(validateDiscountCode).mockResolvedValue({ valid: false, reason: 'expired' })
    await expect(
      computePosSale(admin, { businessId: 'biz1', vanId: 'van1', items: baseItems, discountCode: 'OLD' })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('expired') })
  })

  it('does not look up a CRM customer when neither phone nor email is given', async () => {
    await computePosSale(admin, { businessId: 'biz1', vanId: 'van1', items: baseItems })
    expect(findOrCreateCrmCustomer).not.toHaveBeenCalled()
  })

  it('looks up/creates the CRM customer when a phone or email is given, and passes its id into the discount check', async () => {
    vi.mocked(findOrCreateCrmCustomer).mockResolvedValue({ id: 'cust1' })
    vi.mocked(validateDiscountCode).mockResolvedValue({ valid: true, kind: 'voucher', id: 'v1', discount_amount: 1, description: 'Voucher' })
    await computePosSale(admin, {
      businessId: 'biz1', vanId: 'van1', items: baseItems, discountCode: 'V1',
      customerPhone: '+447700900000',
    })
    expect(findOrCreateCrmCustomer).toHaveBeenCalledWith(admin, 'biz1', expect.objectContaining({ phone: '+447700900000' }))
    expect(validateDiscountCode).toHaveBeenCalledWith(admin, 'biz1', 'V1', expect.objectContaining({ crmCustomerId: 'cust1' }))
  })

  it('never calls validateDiscountCode when no discountCode is given', async () => {
    await computePosSale(admin, { businessId: 'biz1', vanId: 'van1', items: baseItems })
    expect(validateDiscountCode).not.toHaveBeenCalled()
  })
})
