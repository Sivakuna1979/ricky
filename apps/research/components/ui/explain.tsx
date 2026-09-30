'use client'

import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { GLOSSARY } from '@/lib/content/glossary'

/** "Explain simply" popover with Simple / Advanced tabs. */
export function Explain({ k, value, sym = '$' }: { k?: string; value?: string; sym?: string }) {
  const [open, setOpen] = useState(false)
  const [adv, setAdv] = useState(false)
  const entry = k ? GLOSSARY[k] : undefined
  if (!entry) return null
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-accent hover:text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-expanded={open}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        Explain simply
      </button>
      {open && (
        <span role="dialog" className="absolute left-0 top-full z-40 mt-1 w-80 rounded-lg border border-ink-600 bg-ink-900 p-3 text-left text-xs text-fg-2 shadow-2xl">
          <span className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-fg">{entry.term}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-fg-3 hover:text-fg">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
          <span className="mb-2 inline-flex rounded-md border border-ink-600 p-0.5">
            <button type="button" onClick={() => setAdv(false)} className={`rounded px-2 py-0.5 ${!adv ? 'bg-ink-700 text-fg' : 'text-fg-3'}`}>
              Simple
            </button>
            <button type="button" onClick={() => setAdv(true)} className={`rounded px-2 py-0.5 ${adv ? 'bg-ink-700 text-fg' : 'text-fg-3'}`}>
              Advanced
            </button>
          </span>
          <span className="block leading-relaxed">{adv ? entry.advanced : entry.simple(value ?? '', sym)}</span>
        </span>
      )}
    </span>
  )
}
