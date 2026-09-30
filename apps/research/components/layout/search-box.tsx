'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import clsx from 'clsx'

interface Result {
  ticker: string
  name: string
  exchange?: string
  hasFullAnalysis: boolean
}

export function SearchBox({ size = 'md', autoFocus = false }: { size?: 'md' | 'lg'; autoFocus?: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    const ctl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => {
          setResults(d.results ?? [])
          setActive(0)
        })
        .catch(() => {})
    }, 150)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const go = (ticker: string) => {
    setOpen(false)
    setQ('')
    router.push(`/company/${encodeURIComponent(ticker)}`)
  }

  const submit = () => {
    if (results[active]) go(results[active].ticker)
    else if (/^[A-Za-z.\-]{1,10}$/.test(q.trim())) go(q.trim().toUpperCase())
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <div className={clsx('flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/80 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent', size === 'lg' ? 'px-4 py-3.5' : 'px-3 py-2')}>
        <Search className={clsx('shrink-0 text-fg-3', size === 'lg' ? 'h-5 w-5' : 'h-4 w-4')} aria-hidden />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
            else if (e.key === 'Enter') submit()
            else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Search company or ticker…"
          aria-label="Search company or ticker"
          className={clsx('w-full bg-transparent text-fg placeholder:text-fg-4 focus:outline-none', size === 'lg' ? 'text-lg' : 'text-sm')}
          maxLength={40}
        />
        {size === 'lg' && (
          <button type="button" onClick={submit} className="btn btn-primary shrink-0">
            Analyse
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-2xl" role="listbox">
          {results.map((r, i) => (
            <li key={r.ticker} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.ticker)}
                className={clsx('flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm', i === active ? 'bg-ink-750' : '')}
              >
                <span className="min-w-0">
                  <span className="font-semibold text-fg">{r.ticker}</span>
                  <span className="ml-2 truncate text-fg-2">{r.name}</span>
                </span>
                <span className="shrink-0 text-xs text-fg-3">{r.hasFullAnalysis ? 'Full analysis' : r.exchange ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
