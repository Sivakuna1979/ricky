'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { X } from 'lucide-react'

export function TickerPicker({ tickers, options, max = 5 }: { tickers: string[]; options: { ticker: string; name: string }[]; max?: number }) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const go = (list: string[]) => router.push(`/compare?tickers=${list.join(',')}`)
  const add = (t: string) => {
    const T = t.trim().toUpperCase()
    if (!T || tickers.includes(T) || tickers.length >= max || !/^[A-Z0-9.\-]{1,10}$/.test(T)) return
    go([...tickers, T])
    setValue('')
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tickers.map((t) => (
        <span key={t} className="chip border-accent/40 bg-accent-soft py-1 text-sm text-accent">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => go(tickers.filter((x) => x !== t))}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      {tickers.length < max && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add(value)
          }}
          className="flex gap-2"
        >
          <input list="compare-options" className="input w-40" placeholder="Add ticker…" value={value} onChange={(e) => setValue(e.target.value)} maxLength={10} />
          <datalist id="compare-options">
            {options
              .filter((o) => !tickers.includes(o.ticker))
              .map((o) => (
                <option key={o.ticker} value={o.ticker}>
                  {o.name}
                </option>
              ))}
          </datalist>
          <button className="btn">Add</button>
        </form>
      )}
      <span className="text-xs text-fg-4">
        {tickers.length}/{max} companies
      </span>
    </div>
  )
}
