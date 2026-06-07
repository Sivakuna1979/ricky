import type { TrackingStatus } from '@/types/database'

export function TrackingBadge({ status }: { status: TrackingStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500 text-white">
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        LIVE
      </span>
    )
  }
  if (status === 'paused') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white">
        ⏸ Paused
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500 text-white">
      Offline
    </span>
  )
}
