'use client'

import { Star } from 'lucide-react'
import { userActions, useUserData } from '@/components/user/store'

export function WatchButton({ ticker }: { ticker: string }) {
  const { ready, data } = useUserData()
  const on = data.watchlist.includes(ticker)
  return (
    <button type="button" className={`btn ${on ? 'border-accent/50 text-accent' : ''}`} disabled={!ready} onClick={() => userActions.toggleWatch(ticker)} aria-pressed={on}>
      <Star className="h-4 w-4" fill={on ? 'currentColor' : 'none'} /> {on ? 'On watchlist' : 'Watchlist'}
    </button>
  )
}
