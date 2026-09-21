// @ts-nocheck
// J29 — LIVE NOW / NEXT STOP / NOT CURRENTLY TRADING / ORDERING OPEN-CLOSED,
// derived server-side (lib/customer/liveStatus.ts) from real data only.
export function LiveStatusBadge({ liveStatus }: { liveStatus: any }) {
  if (!liveStatus) return null
  const { tradingStatus, orderingOpen, currentStop, nextStop, stopSource } = liveStatus

  const tradingLabel = tradingStatus === 'LIVE_NOW' ? 'Live Now'
    : tradingStatus === 'SCHEDULED_TODAY' ? 'Scheduled Today'
    : 'Not Currently Trading'
  const dotColor = tradingStatus === 'LIVE_NOW' ? '#10b981' : tradingStatus === 'SCHEDULED_TODAY' ? '#fbbf24' : '#6b7280'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${dotColor}22`, border: `1px solid ${dotColor}66`, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: dotColor === '#6b7280' ? '#9ca3af' : dotColor }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, boxShadow: tradingStatus === 'LIVE_NOW' ? `0 0 6px ${dotColor}` : 'none' }} />
          {tradingLabel}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: orderingOpen ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.15)', border: `1px solid ${orderingOpen ? 'rgba(59,130,246,0.4)' : 'rgba(107,114,128,0.3)'}`, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: orderingOpen ? '#93c5fd' : '#9ca3af' }}>
          {orderingOpen ? 'Ordering Open' : 'Ordering Closed'}
        </span>
      </div>
      {(currentStop || nextStop) && (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          {currentStop
            ? <>📍 Currently at <strong style={{ color: '#e5e7eb' }}>{currentStop.location_name}</strong></>
            : <>📍 Next: <strong style={{ color: '#e5e7eb' }}>{nextStop.location_name}</strong> · {stopSource === 'scheduled' ? 'scheduled' : 'due'} {nextStop.scheduled_arrival}</>
          }
        </div>
      )}
    </div>
  )
}
