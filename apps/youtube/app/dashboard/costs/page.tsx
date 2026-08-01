import { createClient } from '@/lib/supabase/server'
import { PRODUCTION_MODE_ESTIMATES } from '@/lib/pipeline/cost'

export default async function CostsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: profile }, { data: costs }] = await Promise.all([
    supabase.from('yt_profiles').select('daily_spend_limit_usd, monthly_spend_limit_usd').single(),
    supabase
      .from('yt_generation_costs')
      .select('stage, provider, estimated_cost_usd, actual_cost_usd, created_at, yt_channels(title)')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const [{ data: dailySpend }, { data: monthlySpend }] = await Promise.all([
    supabase.rpc('yt_spend_for_user', { p_user_id: user?.id, p_since: startOfDay.toISOString() }),
    supabase.rpc('yt_spend_for_user', { p_user_id: user?.id, p_since: startOfMonth.toISOString() }),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Costs</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="text-sm text-neutral-600">Today</div>
          <div className="text-2xl font-bold">${Number(dailySpend ?? 0).toFixed(2)} <span className="text-base font-normal text-neutral-500">/ ${Number(profile?.daily_spend_limit_usd ?? 0).toFixed(2)}</span></div>
        </div>
        <div className="card">
          <div className="text-sm text-neutral-600">This month</div>
          <div className="text-2xl font-bold">${Number(monthlySpend ?? 0).toFixed(2)} <span className="text-base font-normal text-neutral-500">/ ${Number(profile?.monthly_spend_limit_usd ?? 0).toFixed(2)}</span></div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">Estimated cost per video, by production mode</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="py-1">Mode</th><th>Short</th><th>Long-form</th></tr></thead>
          <tbody>
            {Object.entries(PRODUCTION_MODE_ESTIMATES).map(([mode, est]) => (
              <tr key={mode} className="border-t border-neutral-100">
                <td className="py-1 capitalize">{mode.replace('_', ' ')}</td>
                <td>${est.short.toFixed(2)}</td>
                <td>${est.long.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-neutral-500">Estimates only — actual cost is recorded per stage below as each pipeline run completes.</p>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Recent generation costs</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-200 text-left text-neutral-500"><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Provider</th><th className="py-2 pr-3">Channel</th><th className="py-2 pr-3">Cost</th><th className="py-2 pr-3">When</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {costs?.map((c: any, i: number) => (
              <tr key={i}>
                <td className="py-2 pr-3 capitalize">{c.stage}</td>
                <td className="py-2 pr-3">{c.provider}</td>
                <td className="py-2 pr-3">{c.yt_channels?.title}</td>
                <td className="py-2 pr-3">${Number(c.actual_cost_usd ?? c.estimated_cost_usd).toFixed(4)}</td>
                <td className="py-2 pr-3">{new Date(c.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!costs?.length && <p className="py-4 text-sm text-neutral-500">No costs recorded yet.</p>}
      </div>
    </div>
  )
}
