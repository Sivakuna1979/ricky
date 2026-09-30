import type { ReactNode } from 'react'
import clsx from 'clsx'

export function Section({ id, title, kicker, description, actions, children, className }: { id: string; title: string; kicker?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={clsx('card card-pad', className)} aria-labelledby={`${id}-h`}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {kicker && <div className="label mb-1">{kicker}</div>}
          <h2 id={`${id}-h`} className="text-lg font-semibold text-fg">
            {title}
          </h2>
          {description && <div className="mt-1 max-w-3xl text-sm text-fg-3">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function Stat({ label, value, sub, tone, children }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'pos' | 'neu' | 'neg'; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="label">{label}</div>
        {children}
      </div>
      <div className={clsx('num mt-1 text-lg font-semibold', tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : tone === 'neu' ? 'text-neu' : 'text-fg')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-fg-3">{sub}</div>}
    </div>
  )
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'demo'; title?: string; children: ReactNode }) {
  const cls = tone === 'warn' ? 'border-neg/30 bg-neg-soft' : tone === 'demo' ? 'border-neu/40 bg-neu-soft' : 'border-accent/30 bg-accent-soft'
  return (
    <div className={clsx('rounded-lg border p-3 text-sm text-fg-2', cls)}>
      {title && <div className="mb-0.5 font-semibold text-fg">{title}</div>}
      {children}
    </div>
  )
}
