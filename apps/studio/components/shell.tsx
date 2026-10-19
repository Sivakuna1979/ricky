'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Redo2, Undo2, Upload } from 'lucide-react'
import clsx from 'clsx'

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm text-white">S</span>
      Studio
    </Link>
  )
}

interface TopBarProps {
  title: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  children?: React.ReactNode
}

export function TopBar({ title, canUndo, canRedo, onUndo, onRedo, children }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-900 px-4">
      <Logo />
      <span className="hidden text-sm text-fg-4 sm:inline">/</span>
      <span className="hidden truncate text-sm text-fg-3 sm:inline">{title}</span>
      <div className="ml-auto flex items-center gap-2">
        <button className="btn-ghost !px-2" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </button>
        <button className="btn-ghost !px-2" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="h-4 w-4" />
        </button>
        {children}
      </div>
    </header>
  )
}

export function Dropzone({ accept, label, hint, onFile }: { accept: string; label: string; hint: string; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
      className={clsx(
        'flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition',
        over ? 'border-accent bg-accent-soft' : 'border-ink-600 hover:border-ink-500',
      )}
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-800">
        <Upload className="h-6 w-6 text-accent" />
      </span>
      <span className="text-base font-medium">{label}</span>
      <span className="text-sm text-fg-3">{hint}</span>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </button>
  )
}

/** Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z, ignored while typing in a field. */
export function useUndoShortcuts(undo: () => void, redo: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input[type=text], textarea')) return
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])
}
