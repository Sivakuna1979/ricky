import Link from 'next/link'
import { Construction } from 'lucide-react'

export function PlannedModule({ title, phase, summary, scope }: { title: string; phase: string; summary: string; scope: string[] }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="chip border-accent/40 bg-accent-soft text-accent">
        <Construction className="h-3.5 w-3.5" /> {phase}
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-fg">{title}</h1>
      <p className="mt-3 text-fg-2">{summary}</p>
      <div className="card card-pad mt-6">
        <h2 className="label mb-3">Planned scope</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-2">
          {scope.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-sm text-fg-3">
        The architecture, database tables and scoring engine this module depends on are already in place (see <code className="text-fg-2">apps/research/docs/ARCHITECTURE.md</code>).
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/company/AAPL" className="btn btn-primary">
          Open the Apple analysis
        </Link>
        <Link href="/" className="btn">
          Home
        </Link>
      </div>
    </div>
  )
}
