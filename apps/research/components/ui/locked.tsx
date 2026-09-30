import Link from 'next/link'
import { Lock } from 'lucide-react'
import { FEATURE_MIN_PLAN, PLAN_INFO, type Feature } from '@/lib/plans'

export function LockedCard({ feature, title, children }: { feature: Feature; title: string; children?: React.ReactNode }) {
  const plan = PLAN_INFO[FEATURE_MIN_PLAN[feature]]
  return (
    <div className="card card-pad flex flex-col items-start gap-3 border-dashed">
      <div className="flex items-center gap-2 text-fg">
        <Lock className="h-4 w-4 text-neu" /> <span className="font-semibold">{title}</span>
        <span className="chip border-neu/40 bg-neu-soft text-neu">{plan.name}</span>
      </div>
      <p className="text-sm text-fg-3">{children ?? `Available on the ${plan.name} plan and above.`}</p>
      <Link href="/pricing" className="btn btn-primary">
        See plans
      </Link>
    </div>
  )
}
