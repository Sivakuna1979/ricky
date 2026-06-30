import { getCurrentContext } from '@/lib/workspace'
import { getPlan } from '@/lib/plans'
import BillingPlans from '@/components/BillingPlans'

export default async function BillingPage() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const plan = getPlan(workspace.plan)

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-1 text-sm text-neutral-600">
        You’re on the <span className="font-medium capitalize">{plan.name}</span> plan ·{' '}
        status: <span className="capitalize">{workspace.subscription_status}</span>
      </p>
      <div className="mt-6">
        <BillingPlans currentPlan={workspace.plan} />
      </div>
    </div>
  )
}
