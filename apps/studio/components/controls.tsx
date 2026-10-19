'use client'

import { FlipHorizontal2, RotateCw, Type, X } from 'lucide-react'
import clsx from 'clsx'
import {
  ADJUST_RANGES,
  ASPECTS,
  applyPreset,
  NEUTRAL,
  PRESETS,
  type Adjustments,
  type EditState,
  type TextOverlay,
} from '@/lib/edits'

interface Props {
  state: EditState
  onChange: (next: EditState, opts?: { commit?: boolean }) => void
  onCommit: () => void
  presetThumbs?: Record<string, string>
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-b border-ink-700 px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="label">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Presets({ state, onChange, presetThumbs }: Props) {
  const activeId = PRESETS.find((p) => JSON.stringify({ ...NEUTRAL, ...p.adjust }) === JSON.stringify(state.adjust))?.id
  return (
    <Section title="Looks">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(applyPreset(state, p.id))}
            className={clsx('group overflow-hidden rounded-lg border text-left transition', activeId === p.id ? 'border-accent' : 'border-ink-700 hover:border-ink-500')}
          >
            {presetThumbs?.[p.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={presetThumbs[p.id]} alt="" className="aspect-square w-full object-cover" />
            ) : null}
            <span className={clsx('block px-2 py-1.5 text-xs', activeId === p.id ? 'text-fg' : 'text-fg-2')}>{p.label}</span>
          </button>
        ))}
      </div>
    </Section>
  )
}

export function AdjustSliders({ state, onChange, onCommit }: Props) {
  const set = (key: keyof Adjustments, value: number) => onChange({ ...state, adjust: { ...state.adjust, [key]: value } }, { commit: false })
  const changed = JSON.stringify(state.adjust) !== JSON.stringify(NEUTRAL)
  return (
    <Section
      title="Adjust"
      action={
        changed ? (
          <button className="text-xs text-fg-3 hover:text-fg" onClick={() => onChange({ ...state, adjust: NEUTRAL })}>
            Reset
          </button>
        ) : null
      }
    >
      <div className="space-y-3.5">
        {(Object.keys(ADJUST_RANGES) as (keyof Adjustments)[]).map((key) => {
          const r = ADJUST_RANGES[key]
          return (
            <label key={key} className="block">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-fg-2">{r.label}</span>
                <button
                  type="button"
                  className="tabular-nums text-fg-3 hover:text-fg"
                  title="Double-click to reset"
                  onDoubleClick={() => onChange({ ...state, adjust: { ...state.adjust, [key]: NEUTRAL[key] } })}
                >
                  {state.adjust[key] > 0 && r.min < 0 ? '+' : ''}
                  {state.adjust[key]}
                </button>
              </div>
              <input
                type="range"
                min={r.min}
                max={r.max}
                value={state.adjust[key]}
                onChange={(e) => set(key, Number(e.target.value))}
                onPointerUp={onCommit}
                onKeyUp={onCommit}
                onDoubleClick={() => onChange({ ...state, adjust: { ...state.adjust, [key]: NEUTRAL[key] } })}
                aria-label={r.label}
              />
            </label>
          )
        })}
      </div>
    </Section>
  )
}

export function CropRotate({ state, onChange }: Props) {
  return (
    <Section title="Crop & rotate">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {ASPECTS.map((a) => (
          <button key={a} className={clsx('chip', state.aspect === a && 'chip-on')} onClick={() => onChange({ ...state, aspect: a })}>
            {a === 'original' ? 'Original' : a}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => onChange({ ...state, rotate: (((state.rotate + 90) % 360) as EditState['rotate']) })}>
          <RotateCw className="h-4 w-4" /> Rotate
        </button>
        <button className={clsx('btn-ghost flex-1', state.flipH && '!border-accent !text-fg')} onClick={() => onChange({ ...state, flipH: !state.flipH })}>
          <FlipHorizontal2 className="h-4 w-4" /> Flip
        </button>
      </div>
    </Section>
  )
}

const COLORS = ['#ffffff', '#000000', '#facc15', '#f43f5e', '#22d3ee', '#a3e635']

export function TextControls({ state, onChange, onCommit }: Props) {
  const text = state.text
  const update = (patch: Partial<TextOverlay>, commit = true) =>
    onChange({ ...state, text: { content: '', position: 'bottom', size: 'medium', color: '#ffffff', ...text, ...patch } }, { commit })
  return (
    <Section
      title="Text"
      action={
        text ? (
          <button className="text-xs text-fg-3 hover:text-fg" onClick={() => onChange({ ...state, text: null })}>
            <X className="inline h-3.5 w-3.5" /> Remove
          </button>
        ) : null
      }
    >
      <div className="relative">
        <Type className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-fg-4" />
        <textarea
          rows={2}
          value={text?.content ?? ''}
          placeholder="Add a caption…"
          onChange={(e) => update({ content: e.target.value }, false)}
          onBlur={onCommit}
          maxLength={120}
          className="w-full resize-none rounded-lg border border-ink-700 bg-ink-900 py-2 pl-8 pr-2 text-sm text-fg placeholder:text-fg-4 focus:border-accent focus:outline-none"
        />
      </div>
      {text ? (
        <div className="mt-2.5 space-y-2.5">
          <div className="flex gap-1.5">
            {(['top', 'center', 'bottom'] as const).map((p) => (
              <button key={p} className={clsx('chip flex-1 capitalize', text.position === p && 'chip-on')} onClick={() => update({ position: p })}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(['small', 'medium', 'large'] as const).map((s) => (
              <button key={s} className={clsx('chip flex-1 capitalize', text.size === s && 'chip-on')} onClick={() => update({ size: s })}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Text colour ${c}`}
                onClick={() => update({ color: c })}
                className={clsx('h-6 w-6 rounded-full border-2', text.color === c ? 'border-accent' : 'border-ink-600')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  )
}
