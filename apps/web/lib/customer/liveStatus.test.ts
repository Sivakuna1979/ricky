import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getVanLiveStatus } from '@/lib/customer/liveStatus'
import { getSessionForDate } from '@/lib/routes/sessions'

vi.mock('@/lib/routes/sessions', () => ({ getSessionForDate: vi.fn() }))

function adminWithSchedule(todayStops: any[] | null) {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({ data: todayStops }),
          }),
        }),
      }),
    })),
  } as any
}

function adminThatThrows() {
  return { from: vi.fn(() => { throw new Error('db down') }) } as any
}

const van = { id: 'van1', tracking_status: 'offline', accepts_online_orders: true }

beforeEach(() => {
  vi.mocked(getSessionForDate).mockReset()
  vi.useFakeTimers()
  // A Wednesday, well before any schedule departure times used below.
  vi.setSystemTime(new Date('2026-06-17T09:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getVanLiveStatus', () => {
  it('reports NOT_TRADING with no stops when tracking is offline and there is nothing scheduled', async () => {
    vi.mocked(getSessionForDate).mockResolvedValue(null)
    const admin = adminWithSchedule([])
    const result = await getVanLiveStatus(admin, van)
    expect(result.tradingStatus).toBe('NOT_TRADING')
    expect(result.currentStop).toBeNull()
    expect(result.nextStop).toBeNull()
    expect(result.stopSource).toBe('none')
  })

  it('is LIVE_NOW purely from van.tracking_status even with no active route session', async () => {
    vi.mocked(getSessionForDate).mockResolvedValue(null)
    const admin = adminWithSchedule([])
    const result = await getVanLiveStatus(admin, { ...van, tracking_status: 'live' })
    expect(result.tradingStatus).toBe('LIVE_NOW')
  })

  it('promotes to LIVE_NOW and reports an ACTUAL current stop when the route session has one arrived', async () => {
    vi.mocked(getSessionForDate).mockResolvedValue({
      status: 'active',
      stops: [
        { status: 'arrived', location_name: 'Market Square', scheduled_arrival: '12:00', actual_arrival_at: '2026-06-17T11:58:00Z' },
        { status: 'pending', location_name: 'Station Road', scheduled_arrival: '13:00' },
      ],
    })
    const admin = adminWithSchedule([])
    const result = await getVanLiveStatus(admin, van)
    expect(result.tradingStatus).toBe('LIVE_NOW')
    expect(result.stopSource).toBe('actual')
    expect(result.currentStop).toMatchObject({ location_name: 'Market Square' })
    expect(result.nextStop).toMatchObject({ location_name: 'Station Road' })
  })

  it('does not claim LIVE_NOW just because an active session has a pending next stop with no arrival yet', async () => {
    vi.mocked(getSessionForDate).mockResolvedValue({
      status: 'active',
      stops: [{ status: 'pending', location_name: 'Station Road', scheduled_arrival: '13:00' }],
    })
    const admin = adminWithSchedule([])
    const result = await getVanLiveStatus(admin, van)
    expect(result.tradingStatus).toBe('NOT_TRADING')
    expect(result.currentStop).toBeNull()
    expect(result.nextStop).toMatchObject({ location_name: 'Station Road' })
    expect(result.stopSource).toBe('actual')
  })

  it('falls back to the SCHEDULED template (never ACTUAL) when there is no active route session', async () => {
    vi.mocked(getSessionForDate).mockResolvedValue(null)
    const admin = adminWithSchedule([
      { location_name: 'High Street', arrival_time: '08:00', departure_time: '08:30' },
      { location_name: 'Park Lane', arrival_time: '10:00', departure_time: '10:30' },
    ])
    const result = await getVanLiveStatus(admin, van)
    expect(result.stopSource).toBe('scheduled')
    expect(result.tradingStatus).toBe('SCHEDULED_TODAY')
    expect(result.nextStop).toMatchObject({ location_name: 'Park Lane' })
  })

  it('never upgrades an already-LIVE_NOW status to SCHEDULED_TODAY via the fallback', async () => {
    vi.mocked(getSessionForDate).mockResolvedValue(null)
    const admin = adminWithSchedule([{ location_name: 'High Street', arrival_time: '08:00', departure_time: '08:30' }])
    const result = await getVanLiveStatus(admin, { ...van, tracking_status: 'live' })
    expect(result.tradingStatus).toBe('LIVE_NOW')
  })

  it('treats a thrown getSessionForDate as "no active session" and still falls back to schedule', async () => {
    vi.mocked(getSessionForDate).mockRejectedValue(new Error('route session lookup failed'))
    const admin = adminWithSchedule([{ location_name: 'High Street', arrival_time: '08:00', departure_time: '08:30' }])
    const result = await getVanLiveStatus(admin, van)
    expect(result.stopSource).toBe('scheduled')
  })

  it('never throws when the schedule query itself throws', async () => {
    vi.mocked(getSessionForDate).mockResolvedValue(null)
    const admin = adminThatThrows()
    await expect(getVanLiveStatus(admin, van)).resolves.toMatchObject({ tradingStatus: 'NOT_TRADING', stopSource: 'none' })
  })

  it('orderingOpen defaults to true, and is false only when accepts_online_orders is explicitly false', async () => {
    vi.mocked(getSessionForDate).mockResolvedValue(null)
    const admin = adminWithSchedule([])
    const defaultOpen = await getVanLiveStatus(admin, { id: 'van1', tracking_status: 'offline' })
    expect(defaultOpen.orderingOpen).toBe(true)
    const closed = await getVanLiveStatus(admin, { ...van, accepts_online_orders: false })
    expect(closed.orderingOpen).toBe(false)
  })
})
