import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logAiUsage, withAiUsageLog } from '@/lib/ai/usageLog'
import { createAdminClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))

function mockAdmin() {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null })
  const from = vi.fn(() => ({ insert }))
  return { from, insert }
}

beforeEach(() => {
  vi.mocked(createAdminClient).mockReset()
})

describe('logAiUsage', () => {
  it('inserts a row into ai_usage_log with the computed estimated cost', async () => {
    const admin = mockAdmin()
    vi.mocked(createAdminClient).mockResolvedValue(admin as any)

    await logAiUsage({
      feature: 'whatsapp_order_parse',
      model: 'claude-haiku-4-5-20251001',
      usage: { input_tokens: 1000, output_tokens: 500 },
      latencyMs: 842,
      businessId: 'biz1',
      success: true,
    })

    expect(admin.from).toHaveBeenCalledWith('ai_usage_log')
    expect(admin.insert).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'whatsapp_order_parse',
      model: 'claude-haiku-4-5-20251001',
      input_tokens: 1000,
      output_tokens: 500,
      latency_ms: 842,
      business_id: 'biz1',
      success: true,
      error_message: null,
    }))
    const insertedRow = admin.insert.mock.calls[0][0]
    expect(insertedRow.estimated_cost_usd).toBeGreaterThan(0)
  })

  it('defaults businessId to null and records the error message on failure', async () => {
    const admin = mockAdmin()
    vi.mocked(createAdminClient).mockResolvedValue(admin as any)

    await logAiUsage({ feature: 'menu_scan', model: 'claude-opus-4-8', latencyMs: 50, success: false, errorMessage: 'request timed out' })

    expect(admin.insert).toHaveBeenCalledWith(expect.objectContaining({
      business_id: null, success: false, error_message: 'request timed out', input_tokens: 0, output_tokens: 0,
    }))
  })

  it('never throws when the DB write itself fails — logging must not break the AI feature it observes', async () => {
    vi.mocked(createAdminClient).mockRejectedValue(new Error('connection refused'))
    await expect(logAiUsage({ feature: 'menu_scan', model: 'claude-opus-4-8', latencyMs: 10, success: true })).resolves.toBeUndefined()
  })

  it('never throws when the insert call itself rejects', async () => {
    const admin = mockAdmin()
    admin.insert.mockRejectedValue(new Error('RLS violation'))
    vi.mocked(createAdminClient).mockResolvedValue(admin as any)
    await expect(logAiUsage({ feature: 'menu_scan', model: 'claude-opus-4-8', latencyMs: 10, success: true })).resolves.toBeUndefined()
  })
})

describe('withAiUsageLog', () => {
  it('returns the wrapped call result unchanged on success', async () => {
    // createAdminClient deliberately never resolves — proves the wrapper
    // doesn't wait on logging before returning the caller's result.
    vi.mocked(createAdminClient).mockReturnValue(new Promise(() => {}) as any)
    const result = await withAiUsageLog(
      { feature: 'menu_scan', requestedModel: 'claude-opus-4-8' },
      async () => ({ model: 'claude-opus-4-8', usage: { input_tokens: 10, output_tokens: 5 } })
    )
    expect(result).toEqual({ model: 'claude-opus-4-8', usage: { input_tokens: 10, output_tokens: 5 } })
  })

  it('rethrows the wrapped call error unchanged, without swallowing it', async () => {
    vi.mocked(createAdminClient).mockReturnValue(new Promise(() => {}) as any)
    const boom = new Error('model overloaded')
    await expect(
      withAiUsageLog({ feature: 'menu_scan', requestedModel: 'claude-opus-4-8' }, async () => { throw boom })
    ).rejects.toBe(boom)
  })
})
