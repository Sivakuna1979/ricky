'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Undo/redo for editor state. `set(next, { commit: false })` updates live (e.g. while dragging a
 * slider) without creating an undo step; call `commit()` when the gesture ends.
 */
export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState(initial)
  const past = useRef<T[]>([])
  const future = useRef<T[]>([])
  const anchor = useRef<T>(initial) // last committed value
  const [, force] = useState(0)

  const set = useCallback((next: T, opts: { commit?: boolean } = {}) => {
    setPresent(next)
    if (opts.commit !== false) {
      past.current = [...past.current.slice(-99), anchor.current]
      future.current = []
      anchor.current = next
      force((n) => n + 1)
    }
  }, [])

  const commit = useCallback(() => {
    setPresent((cur) => {
      if (cur !== anchor.current) {
        past.current = [...past.current.slice(-99), anchor.current]
        future.current = []
        anchor.current = cur
        force((n) => n + 1)
      }
      return cur
    })
  }, [])

  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (prev === undefined) return
    future.current = [anchor.current, ...future.current]
    anchor.current = prev
    setPresent(prev)
    force((n) => n + 1)
  }, [])

  const redo = useCallback(() => {
    const [next, ...rest] = future.current
    if (next === undefined) return
    future.current = rest
    past.current = [...past.current, anchor.current]
    anchor.current = next
    setPresent(next)
    force((n) => n + 1)
  }, [])

  const reset = useCallback((value: T) => {
    past.current = []
    future.current = []
    anchor.current = value
    setPresent(value)
    force((n) => n + 1)
  }, [])

  return { state: present, set, commit, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 }
}
