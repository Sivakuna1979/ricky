import type { VanType } from '@/types/database'
import { VAN_TYPE_LABELS } from '@/lib/utils/constants'

export function VanTypeBadge({ type }: { type: VanType }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700">
      {VAN_TYPE_LABELS[type] ?? type}
    </span>
  )
}
