import { getViewer } from '@/lib/auth/viewer'
import { hasFeature, LIMITS } from '@/lib/plans'
import { Chat } from '@/components/assistant/chat'
import { Callout } from '@/components/ui/section'

export const metadata = { title: 'AI research assistant' }
export const dynamic = 'force-dynamic'

export default async function AssistantPage() {
  const viewer = await getViewer()
  const live = Boolean(process.env.ANTHROPIC_API_KEY)
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-10 sm:px-6">
      <header>
        <div className="label">AI research assistant</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Ask the evidence</h1>
        <p className="mt-1 text-sm text-fg-3">
          Explanations grounded in the platform’s computed figures. The assistant explains and summarises — it never produces the scores. {LIMITS[viewer.plan].aiQueriesPerDay} questions/day on your plan.
        </p>
      </header>
      {!live && (
        <Callout tone="demo" title="Rules-based mode">
          No <code>ANTHROPIC_API_KEY</code> is configured, so answers are assembled by deterministic rules from the computed data (debt, ROIC, valuation, risks, growth, moat, outlook, comparisons). Set the key to enable Claude.
        </Callout>
      )}
      <div className="card card-pad">
        <Chat
          enabled={hasFeature(viewer.plan, 'ai')}
          suggestions={[
            'Explain Apple’s debt.',
            'Why has Apple’s ROIC changed?',
            'Compare Apple and Microsoft.',
            'Is Apple’s valuation historically expensive?',
            'What are Apple’s biggest risks?',
            'What could Apple’s business look like in 10 years?',
          ]}
        />
      </div>
    </div>
  )
}
