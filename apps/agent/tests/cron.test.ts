import { describe, it, expect } from 'vitest'
import { nextCronRun } from '@/lib/agent/tools/cron'

describe('nextCronRun', () => {
  it('returns null for malformed expressions', () => {
    expect(nextCronRun('not a cron')).toBeNull()
    expect(nextCronRun('* * *')).toBeNull()
  })

  it('computes the next minute for "* * * * *"', () => {
    const from = new Date('2026-01-01T10:00:30Z')
    const next = nextCronRun('* * * * *', from)
    expect(next).not.toBeNull()
    expect(next!.getTime()).toBe(new Date('2026-01-01T10:01:00Z').getTime())
  })

  it('handles a specific daily time', () => {
    const from = new Date('2026-01-01T08:00:00Z')
    const next = nextCronRun('30 9 * * *', from)
    expect(next).not.toBeNull()
    expect(next!.getUTCHours()).toBe(9)
    expect(next!.getUTCMinutes()).toBe(30)
  })

  it('supports step values', () => {
    const from = new Date('2026-01-01T10:02:00Z')
    const next = nextCronRun('*/15 * * * *', from)
    expect(next).not.toBeNull()
    expect(next!.getUTCMinutes() % 15).toBe(0)
  })

  it('always returns a time strictly after the reference', () => {
    const from = new Date('2026-03-15T12:34:56Z')
    const next = nextCronRun('* * * * *', from)
    expect(next!.getTime()).toBeGreaterThan(from.getTime())
  })
})
