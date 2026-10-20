import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { cpus, tmpdir } from 'node:os'
import { join } from 'node:path'
import { planTimeline } from './plan'
import { textPng, type FontRole } from './text'
import { FORMATS, type FilmFormat, type FilmScript, type NarrationClip, type Segment, type Timeline } from './types'

const FPS = 25
const WORK_SCALE = 1.5 // zoompan works on a larger frame so the slow zoom stays smooth
const ZOOM = 0.12

export interface RenderInput {
  script: FilmScript
  photoPath: (id: string) => string
  narration: NarrationClip[]
  musicPath: string | null
  format: FilmFormat
  output: string
  onProgress?: (ratio: number) => void
}

/** Render the whole film to `output` (MP4). Returns the planned timeline. */
export async function renderFilm(input: RenderInput): Promise<Timeline> {
  const timeline = planTimeline(input.script, input.narration, input.photoPath)
  const work = await mkdtemp(join(tmpdir(), 'film-'))
  try {
    const segFiles = timeline.segments.map((_, i) => join(work, `seg-${String(i).padStart(3, '0')}.mp4`))
    let done = 0
    await runPool(
      timeline.segments.map((seg, i) => async () => {
        await renderSegment(seg, segFiles[i], input.format, work, i)
        input.onProgress?.((++done / timeline.segments.length) * 0.85)
      }),
      Math.max(1, Math.floor(cpus().length / 2)),
    )
    await ffmpeg(assembleArgs(timeline, segFiles, input.narration, input.musicPath, input.output))
    input.onProgress?.(1)
    return timeline
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------- segments

async function renderSegment(seg: Segment, out: string, format: FilmFormat, work: string, index: number) {
  const { width: W, height: H } = FORMATS[format]
  const WS = even(W * WORK_SCALE)
  const HS = even(H * WORK_SCALE)
  const frames = Math.round(seg.duration * FPS)
  const unit = Math.min(W, H) // text sizes scale with the short side
  const overlays: { file: string; y: (h: string) => string; delay: number }[] = []

  /** `centerY` is where the middle of the text block sits, as a fraction of the frame height. */
  const addText = async (text: string, opts: { role: FontRole; size: number; centerY: number; delay: number; widthFrac?: number }) => {
    const file = join(work, `t-${index}-${overlays.length}.png`)
    await textPng(text, { role: opts.role, sizePx: opts.size, maxWidth: W * (opts.widthFrac ?? 0.82), out: file })
    overlays.push({ file, y: (hh) => `${Math.round(H * opts.centerY)}-${hh}`, delay: opts.delay })
  }

  let base: string
  if (seg.kind === 'photo') {
    base =
      `[0:v]scale=${WS}:${HS}:force_original_aspect_ratio=increase,crop=${WS}:${HS},gblur=sigma=${Math.round(WS / 40)},eq=brightness=-0.10:saturation=0.75[bg];` +
      `[0:v]scale=${WS}:${HS}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`
    if (seg.caption) await addText(seg.caption, { role: 'italic', size: Math.round(unit * 0.055), centerY: format === 'portrait' ? 0.86 : 0.88, delay: 1.2 })
  } else {
    // Title and end cards: the photo becomes a soft, dark backdrop for the words.
    base = `[0:v]scale=${WS}:${HS}:force_original_aspect_ratio=increase,crop=${WS}:${HS},gblur=sigma=${Math.round(WS / 30)},eq=brightness=-0.28:saturation=0.6`
    if (seg.kind === 'title') {
      await addText(seg.title, { role: 'title', size: Math.round(unit * 0.13), centerY: 0.45, delay: 0.8 })
      if (seg.subtitle) await addText(seg.subtitle, { role: 'italic', size: Math.round(unit * 0.065), centerY: format === 'portrait' ? 0.56 : 0.6, delay: 1.8 })
    } else {
      await addText(seg.text, { role: 'italic', size: Math.round(unit * 0.08), centerY: 0.5, delay: 1.0, widthFrac: 0.75 })
    }
  }

  const zoomIn = seg.kind === 'photo' ? seg.zoomIn : true
  const pan = seg.kind === 'photo' ? seg.pan : 0
  const p = `(on/${frames})`
  const z = zoomIn ? `1+${ZOOM}*${p}` : `${1 + ZOOM}-${ZOOM}*${p}`
  const x = `(iw-iw/zoom)*(0.5+${pan * 0.4}*(${p}-0.5))`
  const zoompan = `zoompan=z='${z}':x='${x}':y='(ih-ih/zoom)/2':d=${frames}:s=${W}x${H}:fps=${FPS}`

  // Each text PNG fades in on top of the moving picture (half its height up from its centre line).
  const parts = [`${base},${zoompan}[v0]`]
  overlays.forEach((o, i) => {
    parts.push(`[${i + 1}:v]format=rgba,fade=t=in:st=${o.delay}:d=1:alpha=1[t${i}]`)
    parts.push(`[v${i}][t${i}]overlay=x=(W-w)/2:y=${o.y('h/2')}[v${i + 1}]`)
  })
  parts.push(`[v${overlays.length}]format=yuv420p[out]`)
  const textInputs = overlays.flatMap((o) => ['-loop', '1', '-framerate', String(FPS), '-t', String(seg.duration), '-i', o.file])
  await ffmpeg(['-i', seg.photo, ...textInputs, '-filter_complex', parts.join(';'), '-map', '[out]', '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-an', out])
}

// ---------------------------------------------------------------- assembly

export function assembleArgs(timeline: Timeline, segFiles: string[], narration: NarrationClip[], musicPath: string | null, output: string): string[] {
  const args: string[] = []
  segFiles.forEach((f) => args.push('-i', f))
  const n = segFiles.length
  narration.forEach((c) => args.push('-i', c.path))
  if (musicPath) args.push('-stream_loop', '-1', '-i', musicPath)

  const parts: string[] = []
  // Video: chain crossfades.
  let prev = '[0:v]'
  for (let k = 1; k < n; k++) {
    const label = k === n - 1 ? '[vx]' : `[v${k}]`
    parts.push(`${prev}[${k}:v]xfade=transition=fade:duration=${timeline.crossfade}:offset=${timeline.starts[k]}${label}`)
    prev = label
  }
  if (n === 1) parts.push('[0:v]null[vx]')
  parts.push(`[vx]fade=t=in:st=0:d=1,fade=t=out:st=${(timeline.total - 1.5).toFixed(3)}:d=1.5[vout]`)

  // Voice: each scene's narration placed at its start time.
  narration.forEach((_, i) => {
    const ms = Math.round(timeline.narrationStarts[i] * 1000)
    parts.push(`[${n + i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[n${i}]`)
  })
  const voiceInputs = narration.map((_, i) => `[n${i}]`).join('')
  parts.push(`${voiceInputs}amix=inputs=${narration.length}:normalize=0:dropout_transition=0,apad[voice]`)

  if (musicPath) {
    const m = n + narration.length
    const fadeOut = (timeline.total - 4).toFixed(3)
    parts.push('[voice]asplit=2[voiceMix][voiceKey]')
    parts.push(`[${m}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.32,afade=t=in:d=2.5,afade=t=out:st=${fadeOut}:d=4[music]`)
    // Duck the music under the narrator, then bring it back up between scenes.
    parts.push('[music][voiceKey]sidechaincompress=threshold=0.02:ratio=8:attack=80:release=900[ducked]')
    parts.push('[voiceMix][ducked]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]')
  } else {
    parts.push('[voice]alimiter=limit=0.95[aout]')
  }

  args.push(
    '-filter_complex', parts.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-t', timeline.total.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    '-y', output,
  )
  return args
}

// ---------------------------------------------------------------- helpers

const even = (n: number) => Math.round(n / 2) * 2
export function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.env.FFMPEG_PATH ?? 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])
    let stderr = ''
    proc.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)))
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code}): ${stderr.trim()}`))))
  })
}

export function probeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.env.FFPROBE_PATH ?? 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
    let out = ''
    proc.stdout.on('data', (d) => (out += d))
    proc.on('error', reject)
    proc.on('close', (code) => {
      const d = Number(out.trim())
      code === 0 && Number.isFinite(d) ? resolve(d) : reject(new Error(`Could not read duration of ${file}`))
    })
  })
}

async function runPool(tasks: (() => Promise<void>)[], size: number) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, tasks.length) }, async () => {
      while (next < tasks.length) await tasks[next++]()
    }),
  )
}
