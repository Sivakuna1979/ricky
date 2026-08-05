'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DIMENSION_LABELS: Record<string, string> = {
  search_demand: 'Search demand',
  competition: 'Competition (low = better)',
  advertiser_suitability: 'Advertiser suitability',
  production_difficulty: 'Production ease',
  evergreen_potential: 'Evergreen potential',
  originality_potential: 'Originality potential',
  copyright_risk: 'Copyright safety',
  retention_potential: 'Retention potential',
  uk_intl_potential: 'UK/international potential',
}

export function NicheTool() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [ack, setAck] = useState(false)

  async function score() {
    setLoading(true)
    setError(null)
    setResult(null)
    const res = await fetch('/api/niches/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error ?? 'Scoring failed')
    setResult(data)
  }

  async function save() {
    if (!result) return
    await fetch('/api/niches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        scores: {
          search_demand_score: result.scores.search_demand,
          competition_score: result.scores.competition,
          advertiser_suitability_score: result.scores.advertiser_suitability,
          production_difficulty_score: result.scores.production_difficulty,
          evergreen_score: result.scores.evergreen_potential,
          originality_potential_score: result.scores.originality_potential,
          copyright_risk_score: result.scores.copyright_risk,
          retention_potential_score: result.scores.retention_potential,
          uk_intl_potential_score: result.scores.uk_intl_potential,
        },
        overallScore: result.overallScore,
        safeguardsAcknowledged: ack,
      }),
    })
    setResult(null)
    setName('')
    setDescription('')
    router.refresh()
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Compare a niche</h2>
      <div>
        <label className="label">Niche name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Personal finance basics" />
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <button className="btn-primary" onClick={score} disabled={loading || !name}>{loading ? 'Scoring…' : 'Score this niche'}</button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-lg border border-neutral-200 p-3">
          <div className="mb-2 text-lg font-bold">Overall score: {result.overallScore}/10</div>
          {result.isSensitive && (
            <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              This niche looks like it falls under <strong>{result.sensitiveCategory}</strong> content, which needs
              extra safeguards before it can be automated (see YouTube's medical/legal/financial/political/etc.
              guidance). Confirm you understand the risk to enable it.
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                I understand and accept responsibility for this sensitive niche
              </label>
            </div>
          )}
          <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {Object.entries(result.scores).map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-neutral-100 py-1">
                <span>{DIMENSION_LABELS[k] ?? k}</span>
                <span className="font-medium">{v as number}/10</span>
              </li>
            ))}
          </ul>
          <button className="btn-outline mt-3" onClick={save} disabled={result.isSensitive && !ack}>Save this niche</button>
        </div>
      )}
    </div>
  )
}
