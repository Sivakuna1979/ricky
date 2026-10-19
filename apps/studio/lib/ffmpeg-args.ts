import { cropRect, warmthGains, type EditState } from './edits'

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2)
const fixed = (n: number) => Number(n.toFixed(4)).toString()

/** atempo only accepts 0.5–2.0 per instance, so chain it for larger changes. */
export function atempoChain(speed: number): string[] {
  const out: string[] = []
  let s = speed
  while (s > 2) {
    out.push('atempo=2')
    s /= 2
  }
  while (s < 0.5) {
    out.push('atempo=0.5')
    s /= 0.5
  }
  if (Math.abs(s - 1) > 1e-3) out.push(`atempo=${fixed(s)}`)
  return out
}

export interface VideoExportPlan {
  args: string[]
  width: number
  height: number
  hasTextOverlay: boolean
}

/**
 * Build ffmpeg arguments that reproduce the editor preview: rotate/flip → crop → colour → blur →
 * vignette → text overlay, plus trim, speed and volume. Output is an H.264/AAC MP4.
 */
export function buildFfmpegArgs(
  state: EditState,
  video: { width: number; height: number; duration: number },
  files = { input: 'input', overlay: 'overlay.png', output: 'output.mp4' },
  maxEdge = 1920,
): VideoExportPlan {
  const v: string[] = []
  if (state.rotate === 90) v.push('transpose=1')
  if (state.rotate === 180) v.push('transpose=1,transpose=1')
  if (state.rotate === 270) v.push('transpose=2')
  if (state.flipH) v.push('hflip')

  const rotated = state.rotate === 90 || state.rotate === 270
  const rw = rotated ? video.height : video.width
  const rh = rotated ? video.width : video.height
  const crop = cropRect(rw, rh, state.aspect)
  if (state.aspect !== 'original') v.push(`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`)

  const scale = Math.min(1, maxEdge / Math.max(crop.w, crop.h))
  const width = even(crop.w * scale)
  const height = even(crop.h * scale)
  v.push(`scale=${width}:${height}`)

  const a = state.adjust
  if (a.brightness || a.contrast || a.saturation) {
    // eq's brightness is additive while CSS brightness() multiplies; 0.3 keeps the two visually close.
    v.push(`eq=brightness=${fixed((a.brightness / 100) * 0.3)}:contrast=${fixed(1 + a.contrast / 100)}:saturation=${fixed(1 + a.saturation / 100)}`)
  }
  if (a.hue) v.push(`hue=h=${a.hue}`)
  if (a.warmth) {
    const g = warmthGains(a.warmth)
    v.push(`colorchannelmixer=rr=${fixed(g.r)}:gg=${fixed(g.g)}:bb=${fixed(g.b)}`)
  }
  if (a.blur) v.push(`gblur=sigma=${fixed((a.blur * width) / 1000)}`)
  if (a.vignette) v.push(`vignette=angle=${fixed((a.vignette / 100) * 0.9)}`)
  if (state.speed !== 1) v.push(`setpts=PTS/${fixed(state.speed)}`)
  v.push('format=yuv420p')

  const hasTextOverlay = Boolean(state.text?.content.trim())
  const end = state.trimEnd ?? video.duration
  const length = Math.max(0.1, end - state.trimStart)

  const args = ['-ss', fixed(state.trimStart), '-t', fixed(length), '-i', files.input]
  if (hasTextOverlay) args.push('-i', files.overlay)

  const graph = hasTextOverlay ? `[0:v]${v.join(',')}[base];[base][1:v]overlay=0:0[v]` : `[0:v]${v.join(',')}[v]`
  args.push('-filter_complex', graph, '-map', '[v]')

  if (state.volume > 0) {
    const af = [...atempoChain(state.speed)]
    if (state.volume !== 1) af.push(`volume=${fixed(state.volume)}`)
    args.push('-map', '0:a?')
    if (af.length) args.push('-af', af.join(','))
    args.push('-c:a', 'aac', '-b:a', '128k')
  } else {
    args.push('-an')
  }

  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-movflags', '+faststart', files.output)
  return { args, width, height, hasTextOverlay }
}
