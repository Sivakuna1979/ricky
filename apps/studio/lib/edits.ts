/**
 * One edit model shared by the photo editor, the video editor and the AI
 * assistant. Everything is non-destructive: the original file is never touched,
 * and an export re-applies this state from scratch.
 */

export type Aspect = 'original' | '1:1' | '4:5' | '9:16' | '16:9' | '4:3'
export type TextPosition = 'top' | 'center' | 'bottom'
export type TextSize = 'small' | 'medium' | 'large'

export interface Adjustments {
  brightness: number // -100..100
  contrast: number // -100..100
  saturation: number // -100..100
  warmth: number // -100..100 (negative = cooler/blue, positive = warmer/orange)
  hue: number // -180..180 degrees
  blur: number // 0..20 px (relative to a 1000px-wide image)
  vignette: number // 0..100
}

export interface TextOverlay {
  content: string
  position: TextPosition
  size: TextSize
  color: string // #rrggbb
}

export interface EditState {
  adjust: Adjustments
  aspect: Aspect
  rotate: 0 | 90 | 180 | 270
  flipH: boolean
  text: TextOverlay | null
  // Video only
  trimStart: number // seconds
  trimEnd: number | null // seconds; null = until the end
  speed: number // 0.25..4
  volume: number // 0..2 (0 = muted)
}

export const ADJUST_RANGES: Record<keyof Adjustments, { min: number; max: number; label: string }> = {
  brightness: { min: -100, max: 100, label: 'Brightness' },
  contrast: { min: -100, max: 100, label: 'Contrast' },
  saturation: { min: -100, max: 100, label: 'Saturation' },
  warmth: { min: -100, max: 100, label: 'Warmth' },
  hue: { min: -180, max: 180, label: 'Hue' },
  blur: { min: 0, max: 20, label: 'Blur' },
  vignette: { min: 0, max: 100, label: 'Vignette' },
}

export const ASPECTS: Aspect[] = ['original', '1:1', '4:5', '9:16', '16:9', '4:3']

export const NEUTRAL: Adjustments = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, hue: 0, blur: 0, vignette: 0 }

export const DEFAULT_STATE: EditState = {
  adjust: NEUTRAL,
  aspect: 'original',
  rotate: 0,
  flipH: false,
  text: null,
  trimStart: 0,
  trimEnd: null,
  speed: 1,
  volume: 1,
}

/** One-tap looks. A preset is just a set of adjustments, so it stays editable afterwards. */
export const PRESETS: { id: string; label: string; adjust: Partial<Adjustments> }[] = [
  { id: 'none', label: 'Original', adjust: {} },
  { id: 'vivid', label: 'Vivid', adjust: { contrast: 15, saturation: 35, brightness: 5 } },
  { id: 'warm', label: 'Golden', adjust: { warmth: 40, saturation: 10, brightness: 5 } },
  { id: 'cool', label: 'Cool', adjust: { warmth: -35, contrast: 5 } },
  { id: 'mono', label: 'Mono', adjust: { saturation: -100, contrast: 20 } },
  { id: 'vintage', label: 'Vintage', adjust: { warmth: 30, saturation: -25, contrast: -10, vignette: 45 } },
  { id: 'cinematic', label: 'Cinematic', adjust: { contrast: 25, saturation: -15, warmth: -10, vignette: 35 } },
  { id: 'fade', label: 'Fade', adjust: { contrast: -30, brightness: 10, saturation: -20 } },
  { id: 'dramatic', label: 'Dramatic', adjust: { contrast: 45, brightness: -10, saturation: 10, vignette: 55 } },
]

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function applyPreset(state: EditState, presetId: string): EditState {
  const preset = PRESETS.find((p) => p.id === presetId)
  if (!preset) return state
  return { ...state, adjust: { ...NEUTRAL, ...preset.adjust } }
}

/** The shape the AI returns: every field is optional/null meaning "leave as is". */
export interface EditPatch {
  reset?: boolean | null
  adjust?: Partial<Record<keyof Adjustments, number | null>> | null
  aspect?: Aspect | null
  rotate?: number | null
  flipH?: boolean | null
  text?: (Partial<TextOverlay> & { remove?: boolean | null }) | null
  trimStart?: number | null
  trimEnd?: number | null
  speed?: number | null
  volume?: number | null
}

/** Merge a (possibly sloppy) patch into a state, clamping every value to its safe range. */
export function applyPatch(base: EditState, patch: EditPatch, duration?: number): EditState {
  const next: EditState = patch.reset ? { ...DEFAULT_STATE } : { ...base, adjust: { ...base.adjust } }

  if (patch.adjust) {
    for (const key of Object.keys(ADJUST_RANGES) as (keyof Adjustments)[]) {
      const v = patch.adjust[key]
      if (typeof v === 'number' && Number.isFinite(v)) {
        next.adjust[key] = Math.round(clamp(v, ADJUST_RANGES[key].min, ADJUST_RANGES[key].max))
      }
    }
  }
  if (patch.aspect && ASPECTS.includes(patch.aspect)) next.aspect = patch.aspect
  if (typeof patch.rotate === 'number' && Number.isFinite(patch.rotate)) {
    next.rotate = ((((Math.round(patch.rotate / 90) * 90) % 360) + 360) % 360) as EditState['rotate']
  }
  if (typeof patch.flipH === 'boolean') next.flipH = patch.flipH

  if (patch.text) {
    if (patch.text.remove) next.text = null
    else {
      const prev = next.text ?? { content: '', position: 'bottom', size: 'medium', color: '#ffffff' }
      const merged: TextOverlay = {
        content: (patch.text.content ?? prev.content).slice(0, 120),
        position: (['top', 'center', 'bottom'] as const).includes(patch.text.position as TextPosition) ? (patch.text.position as TextPosition) : prev.position,
        size: (['small', 'medium', 'large'] as const).includes(patch.text.size as TextSize) ? (patch.text.size as TextSize) : prev.size,
        color: /^#[0-9a-f]{6}$/i.test(patch.text.color ?? '') ? (patch.text.color as string) : prev.color,
      }
      next.text = merged.content.trim() ? merged : null
    }
  }

  const max = duration && Number.isFinite(duration) ? duration : Infinity
  if (typeof patch.trimStart === 'number' && Number.isFinite(patch.trimStart)) next.trimStart = clamp(patch.trimStart, 0, max)
  if (typeof patch.trimEnd === 'number' && Number.isFinite(patch.trimEnd)) next.trimEnd = clamp(patch.trimEnd, 0, max)
  if (next.trimEnd !== null && next.trimEnd <= next.trimStart) next.trimEnd = null
  if (typeof patch.speed === 'number' && Number.isFinite(patch.speed)) next.speed = clamp(patch.speed, 0.25, 4)
  if (typeof patch.volume === 'number' && Number.isFinite(patch.volume)) next.volume = clamp(patch.volume, 0, 2)
  return next
}

/** CSS filter for live previews and canvas rendering (warmth and vignette are drawn separately). */
export function cssFilter(a: Adjustments, scale = 1): string {
  const parts = [
    `brightness(${(1 + a.brightness / 100).toFixed(3)})`,
    `contrast(${(1 + a.contrast / 100).toFixed(3)})`,
    `saturate(${(1 + a.saturation / 100).toFixed(3)})`,
  ]
  if (a.hue) parts.push(`hue-rotate(${a.hue}deg)`)
  if (a.blur) parts.push(`blur(${(a.blur * scale).toFixed(2)}px)`)
  return parts.join(' ')
}

/** Per-channel multipliers for warmth; shared by the canvas renderer and the SVG preview filter. */
export function warmthGains(warmth: number): { r: number; g: number; b: number } {
  const w = warmth / 100
  return { r: 1 + 0.18 * w, g: 1 + 0.04 * w, b: 1 - 0.22 * w }
}

export function aspectRatio(aspect: Aspect): number | null {
  if (aspect === 'original') return null
  const [w, h] = aspect.split(':').map(Number)
  return w / h
}

/** Centered crop rectangle (in source pixels) for a given target aspect, after rotation. */
export function cropRect(width: number, height: number, aspect: Aspect) {
  const ratio = aspectRatio(aspect)
  if (!ratio) return { x: 0, y: 0, w: width, h: height }
  let w = width
  let h = Math.round(width / ratio)
  if (h > height) {
    h = height
    w = Math.round(height * ratio)
  }
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w, h }
}

export const TEXT_SCALE: Record<TextSize, number> = { small: 0.045, medium: 0.07, large: 0.11 }

export function isNeutral(state: EditState): boolean {
  return JSON.stringify(state) === JSON.stringify(DEFAULT_STATE)
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const t = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${t}`
}
