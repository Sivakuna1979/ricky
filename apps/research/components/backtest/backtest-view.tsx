'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { FlaskConical, Upload } from 'lucide-react'
import { BUCKETS, HORIZONS, parseObservationsCsv, randomSelfTest, runBacktest, type BacktestReport } from '@/lib/backtest/engine'
import { Callout } from '@/components/ui/section'

const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)

function Report({ r, synthetic }: { r: BacktestReport; synthetic: boolean }) {
  return (
    <div className="space-y-4">
      {synthetic && (
        <Callout tone="demo" title="SYNTHETIC RANDOM DATA — not evidence">
          Scores in this self-test are random numbers with no relationship to returns. A correct engine should therefore show no systematic difference between buckets, and it should catch the deliberately leaked
          look-ahead observations. It demonstrates the calculation — it says nothing about whether the methodology works.
        </Callout>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Observations', r.input],
          ['Used', r.used],
          ['Excluded: look-ahead', r.excludedLookAhead],
          ['Excluded: invalid', r.excludedInvalid],
          ['Delisted included', r.delistedIncluded],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-lg border border-ink-700 p-3">
            <div className="label">{k}</div>
            <div className="num mt-1 text-lg font-semibold text-fg">{v}</div>
          </div>
        ))}
      </div>
      {r.warnings.length > 0 && (
        <ul className="space-y-1 text-sm text-neu">
          {r.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
      {HORIZONS.map((h) => (
        <div key={h}>
          <h3 className="mb-2 text-sm font-semibold text-fg">
            {h}-year forward returns{' '}
            <span className="ml-2 text-xs font-normal text-fg-3">
              Higher buckets outperform monotonically: {r.monotonic[h] === null || r.monotonic[h] === undefined ? 'insufficient data' : r.monotonic[h] ? 'yes' : 'no'}
            </span>
          </h3>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Score bucket</th>
                  <th className="text-right">N</th>
                  <th className="text-right">Mean return</th>
                  <th className="text-right">Median return</th>
                  <th className="text-right">Benchmark</th>
                  <th className="text-right">Mean excess</th>
                  <th className="text-right">Beat benchmark</th>
                </tr>
              </thead>
              <tbody>
                {BUCKETS.map((b) => {
                  const s = r.stats.find((x) => x.bucket === b && x.horizon === h)!
                  return (
                    <tr key={b}>
                      <td className="text-fg">{b}</td>
                      <td className="num text-right">{s.n}</td>
                      <td className="num text-right">{pct(s.meanReturn)}</td>
                      <td className="num text-right">{pct(s.medianReturn)}</td>
                      <td className="num text-right">{pct(s.meanBenchmark)}</td>
                      <td className={clsx('num text-right font-medium', s.meanExcess === null ? '' : s.meanExcess >= 0 ? 'text-pos' : 'text-neg')}>{pct(s.meanExcess)}</td>
                      <td className="num text-right">{s.hitRate === null ? '—' : `${s.hitRate.toFixed(0)}%`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

export function BacktestView() {
  const [report, setReport] = useState<{ r: BacktestReport; synthetic: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="space-y-5">
      <div className="card card-pad space-y-3">
        <h2 className="font-semibold text-fg">Run the engine</h2>
        <p className="text-sm text-fg-3">
          Upload point-in-time observations as CSV (processed in your browser; nothing is uploaded) with columns{' '}
          <code className="text-fg-2">ticker, score_date, data_available_at, score, delisted, ret_1y, ret_3y, ret_5y, bench_1y, bench_3y, bench_5y</code>. Returns are total returns in %.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="btn cursor-pointer">
            <Upload className="h-4 w-4" /> Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                if (f.size > 20_000_000) return setErr('File too large (max 20 MB).')
                const obs = parseObservationsCsv(await f.text())
                if (!obs.length) return setErr('No rows found — check the header row.')
                setErr(null)
                setReport({ r: runBacktest(obs), synthetic: false })
              }}
            />
          </label>
          <button type="button" className="btn" onClick={() => setReport({ r: runBacktest(randomSelfTest()), synthetic: true })}>
            <FlaskConical className="h-4 w-4" /> Run engine self-test (random data)
          </button>
        </div>
        {err && <p className="text-sm text-neg">{err}</p>}
      </div>
      {report && (
        <div className="card card-pad">
          <Report r={report.r} synthetic={report.synthetic} />
        </div>
      )}
    </div>
  )
}
