'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { PLANS, type Plan } from '@/lib/plans'

export default function BillingPlans({ currentPlan }: { currentPlan: string }) {
  const [busy, setBusy] = useState<string | null>(null)

  async function choose(plan: Plan) {
    if (plan.id === 'free') return
    setBusy(plan.id)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: plan.id }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (data.url) window.location.href = data.url
    else alert(data.error ?? 'Could not start checkout. Billing may not be configured yet.')
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
      {Object.values(PLANS).map((plan) => {
        const current = plan.id === currentPlan
        return (
          <div key={plan.id} className={`card flex flex-col ${plan.id === 'pro' ? 'ring-2 ring-brand' : ''}`}>
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <div className="mt-1 text-2xl font-extrabold">
              ${plan.priceMonthly}
              <span className="text-sm font-normal text-neutral-500">/mo</span>
            </div>
            <ul className="mt-4 flex-1 space-y-1.5 text-xs">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                  <span className="text-neutral-700">{f}</span>
                </li>
              ))}
            </ul>
            <button
              className={`mt-4 ${current ? 'btn-outline' : 'btn-primary'} w-full`}
              disabled={current || busy === plan.id || plan.id === 'free'}
              onClick={() => choose(plan)}
            >
              {current ? 'Current plan' : busy === plan.id ? 'Redirecting…' : `Choose ${plan.name}`}
            </button>
          </div>
        )
      })}
    </div>
  )
}
