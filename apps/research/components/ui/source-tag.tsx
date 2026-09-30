import clsx from 'clsx'
import type { SourceRef } from '@/lib/domain/types'
import { fmtDate } from '@/lib/format'

const TIER_LABEL: Record<SourceRef['tier'], string> = {
  filing: 'Filing',
  provider: 'Provider',
  derived: 'Derived',
  estimate: 'Estimate',
  editorial: 'Editorial',
  demo: 'Demo data',
}

/** Small provenance chip; hover/focus reveals source, period and update date. */
export function SourceTag({ source, className }: { source?: SourceRef; className?: string }) {
  if (!source) return <span className={clsx('chip border-ink-600 text-fg-4', className)}>Source unavailable</span>
  const demo = source.tier === 'demo'
  return (
    <span className={clsx('group relative inline-flex', className)}>
      <span
        tabIndex={0}
        className={clsx(
          'chip cursor-help select-none text-[10px] uppercase tracking-wider',
          demo ? 'border-neu/40 bg-neu-soft text-neu' : 'border-accent/30 bg-accent-soft text-accent',
        )}
      >
        {TIER_LABEL[source.tier]}
      </span>
      <span className="pointer-events-none invisible absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-ink-600 bg-ink-900 p-3 text-left text-xs normal-case tracking-normal text-fg-2 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <span className="block font-medium text-fg">{source.name}</span>
        {source.period && <span className="mt-1 block">Period: {source.period}</span>}
        <span className="mt-1 block">Updated: {fmtDate(source.updated)}</span>
        {source.note && <span className="mt-1 block text-fg-3">{source.note}</span>}
        {source.url && <span className="mt-1 block break-all text-accent">{source.url}</span>}
      </span>
    </span>
  )
}
