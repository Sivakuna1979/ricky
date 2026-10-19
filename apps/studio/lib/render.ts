import { cropRect, DEFAULT_STATE, cssFilter, TEXT_SCALE, warmthGains, type EditState, type TextOverlay } from './edits'

type Source = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement

function sourceSize(src: Source) {
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight }
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight }
  return { w: src.width, h: src.height }
}

// Reused between calls so live video previews don't allocate a canvas per frame.
let scratch: HTMLCanvasElement | null = null

/**
 * Render a source with the full edit state onto a new canvas.
 * `maxSize` limits the longest edge (use a small value for previews, null for full-resolution export).
 */
export function renderEdited(src: Source, state: EditState, maxSize: number | null = null, target?: HTMLCanvasElement): HTMLCanvasElement {
  const { w: sw, h: sh } = sourceSize(src)
  const rotated = state.rotate === 90 || state.rotate === 270
  const rw = rotated ? sh : sw
  const rh = rotated ? sw : sh

  // 1. Rotate + flip into an intermediate canvas.
  const oriented = scratch ?? (scratch = document.createElement('canvas'))
  if (oriented.width !== rw) oriented.width = rw
  if (oriented.height !== rh) oriented.height = rh
  const o = oriented.getContext('2d')!
  o.setTransform(1, 0, 0, 1, 0, 0)
  o.clearRect(0, 0, rw, rh)
  o.translate(rw / 2, rh / 2)
  o.rotate((state.rotate * Math.PI) / 180)
  if (state.flipH) o.scale(-1, 1)
  o.drawImage(src, -sw / 2, -sh / 2, sw, sh)

  // 2. Crop to the aspect ratio, scale, and apply CSS-style colour filters.
  const crop = cropRect(rw, rh, state.aspect)
  const scale = maxSize ? Math.min(1, maxSize / Math.max(crop.w, crop.h)) : 1
  const out = target ?? document.createElement('canvas')
  const ow = Math.max(1, Math.round(crop.w * scale))
  const oh = Math.max(1, Math.round(crop.h * scale))
  // Assigning width/height clears the canvas, so only do it when the size actually changes.
  if (out.width !== ow) out.width = ow
  if (out.height !== oh) out.height = oh
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, out.width, out.height)
  ctx.filter = cssFilter(state.adjust, out.width / 1000)
  ctx.drawImage(oriented, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height)
  ctx.filter = 'none'

  // 3. Warmth (per-channel gain) — not available as a CSS filter, so do it on pixels.
  if (state.adjust.warmth) {
    const { r, g, b } = warmthGains(state.adjust.warmth)
    const img = ctx.getImageData(0, 0, out.width, out.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, d[i] * r)
      d[i + 1] = Math.min(255, d[i + 1] * g)
      d[i + 2] = Math.min(255, d[i + 2] * b)
    }
    ctx.putImageData(img, 0, 0)
  }

  // 4. Vignette.
  if (state.adjust.vignette) drawVignette(ctx, out.width, out.height, state.adjust.vignette)

  // 5. Text.
  if (state.text) drawText(ctx, out.width, out.height, state.text)
  return out
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const r = Math.hypot(w, h) / 2
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${(amount / 100) * 0.85})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export function drawText(ctx: CanvasRenderingContext2D, w: number, h: number, text: TextOverlay) {
  const size = Math.round(Math.min(w, h) * TEXT_SCALE[text.size])
  ctx.font = `800 ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = wrap(ctx, text.content, w * 0.88)
  const lineH = size * 1.15
  const block = lineH * lines.length
  const margin = h * 0.07
  const top = text.position === 'top' ? margin : text.position === 'center' ? (h - block) / 2 : h - margin - block
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(2, size * 0.12)
  ctx.strokeStyle = 'rgba(0,0,0,0.65)'
  ctx.fillStyle = text.color
  lines.forEach((line, i) => {
    const y = top + lineH * i + lineH / 2
    ctx.strokeText(line, w / 2, y)
    ctx.fillText(line, w / 2, y)
  })
}

function wrap(ctx: CanvasRenderingContext2D, content: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of content.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line)
        line = word
      } else line = test
    }
    lines.push(line)
  }
  return lines
}

/** Transparent PNG with just the text, used as an ffmpeg overlay for video export. */
export async function textOverlayPng(w: number, h: number, text: TextOverlay): Promise<Uint8Array> {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  drawText(c.getContext('2d')!, w, h, text)
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

/** Small JPEG of the current look, sent to Claude so it can "see" what it is editing. */
export function snapshotForAi(src: Source, state: EditState = DEFAULT_STATE, maxSize = 768): string {
  return renderEdited(src, state, maxSize).toDataURL('image/jpeg', 0.8)
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), type, quality))
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
