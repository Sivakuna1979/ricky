'use client'

import { useState } from 'react'
import type { SubscriptionPlan, Subscription } from '@/types/database'
import { formatCurrency } from '@/lib/utils/format'
import { toast } from 'sonner'

interface Props {
  plans: SubscriptionPlan[]
  currentSubscription?: Subscription & { subscription_plans: SubscriptionPlan }
  businessId: string
}

export function SubscriptionPlans({ plans, currentSubscription, businessId }: Props) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  const subscribe = async (planId: string) => {
    setLoading(planId)
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: businessId, plan_id: planId, billing_period: billing }),
    })

    if (!res.ok) {
      toast.error('Failed to start subscription')
      setLoading(null)
      return
    }

    const { client_secret } = await res.json()
    if (client_secret) {
      // Redirect to payment — in production, use Stripe Elements or redirect to billing portal
      toast.info('Redirecting to payment...')
    } else {
      toast.success('Subscription updated!')
    }
    setLoading(null)
  }

  const yearlyDiscount = (plan: SubscriptionPlan) => {
    const monthlyAnnual = plan.price_monthly * 12
    const saving = monthlyAnnual - plan.price_yearly
    return saving > 0 ? Math.round((saving / monthlyAnnual) * 100) : 0
  }

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
        <button
          onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
          className={`relative w-12 h-6 rounded-full transition-colors ${billing === 'yearly' ? 'bg-brand-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billing === 'yearly' ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
        <span className={`text-sm font-medium ${billing === 'yearly' ? 'text-gray-900' : 'text-gray-400'}`}>
          Yearly <span className="text-green-600 font-bold">Save up to 17%</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, i) => {
          const isCurrent = currentSubscription?.plan_id === plan.id
          const price = billing === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly
          const discount = yearlyDiscount(plan)
          const popular = i === 1

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 ${
                popular ? 'border-brand-500 shadow-lg' : 'border-gray-200'
              } ${isCurrent ? 'bg-brand-50' : 'bg-white'}`}
            >
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <h3 className="font-bold text-xl text-gray-900">{plan.name}</h3>
              <p className="text-gray-500 text-sm mt-1">{plan.description}</p>

              <div className="my-4">
                <span className="text-4xl font-bold text-gray-900">{formatCurrency(price)}</span>
                <span className="text-gray-500">/month</span>
                {billing === 'yearly' && discount > 0 && (
                  <p className="text-xs text-green-600 font-medium mt-1">
                    {formatCurrency(plan.price_yearly)}/year · Save {discount}%
                  </p>
                )}
              </div>

              <p className="text-sm font-medium text-gray-700 mb-3">
                Up to <span className="text-brand-500">{plan.max_vans === 999 ? 'Unlimited' : plan.max_vans}</span> van{plan.max_vans !== 1 ? 's' : ''}
              </p>

              <ul className="space-y-2 mb-6">
                {Object.entries(plan.features ?? {}).map(([key, enabled]) => enabled && (
                  <li key={key} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500">✓</span>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full py-3 bg-brand-100 text-brand-700 rounded-xl text-sm font-semibold text-center">
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => subscribe(plan.id)}
                  disabled={!!loading}
                  className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                    popular
                      ? 'bg-brand-500 text-white hover:bg-brand-600'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-50`}
                >
                  {loading === plan.id ? 'Processing...' : 'Get Started'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
