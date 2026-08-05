import { spawn } from 'child_process'
import path from 'path'

// This file is the one place in the codebase that shells out to the
// `ffmpeg` binary, and it only ever runs inside the worker process
// (Railway/Render/Cloud Run — see worker/index.ts), never in a Vercel
// serverless function. The host must have ffmpeg (with libx264, aac and
// libass/subtitles support) on PATH; see apps/youtube/SETUP.md.

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args)
    let stderr = ''
    proc.stderr.on('data', (d) => (stderr += d.toString()))
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${bin} exited with code ${code}\n${stderr.slice(-4000)}`))
    })
  })
}

export interface SceneInput {
  filePath: string
  isVideo: boolean
  durationSeconds: number
}

export interface RenderInput {
  scenes: SceneInput[]
  voiceoverPath: string
  musicPath: string | null
  srtPath: string
  outputPath: string
  width: number
  height: number
  fps?: number
}

// Builds one ffmpeg invocation that: scales/crops every scene asset to the
// target frame, applies a slow "Ken Burns" zoom to still images, concatenates
// the scenes back to back, burns in the subtitle track, and mixes the
// narration with ducked background music. Video length follows the
// narration track (the pipeline sizes scene durations to match it already).
export async function renderVideo(input: RenderInput): Promise<{ outputPath: string }> {
  const fps = input.fps ?? 30
  const { width, height } = input

  const args: string[] = ['-y']
  for (const scene of input.scenes) {
    if (scene.isVideo) {
      args.push('-t', String(scene.durationSeconds), '-i', scene.filePath)
    } else {
      args.push('-loop', '1', '-t', String(scene.durationSeconds), '-i', scene.filePath)
    }
  }
  const voiceIndex = input.scenes.length
  args.push('-i', input.voiceoverPath)
  const musicIndex = input.musicPath ? voiceIndex + 1 : null
  if (input.musicPath) args.push('-i', input.musicPath)

  const filterParts: string[] = []
  const sceneLabels: string[] = []
  input.scenes.forEach((scene, i) => {
    const label = `v${i}`
    const frames = Math.max(1, Math.round(scene.durationSeconds * fps))
    if (scene.isVideo) {
      filterParts.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},setsar=1[${label}]`
      )
    } else {
      // Slow zoom-in (Ken Burns) across the still's on-screen duration.
      filterParts.push(
        `[${i}:v]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2},` +
          `zoompan=z='min(zoom+0.0012,1.15)':d=${frames}:s=${width}x${height}:fps=${fps},setsar=1[${label}]`
      )
    }
    sceneLabels.push(`[${label}]`)
  })

  filterParts.push(`${sceneLabels.join('')}concat=n=${input.scenes.length}:v=1:a=0[vconcat]`)

  const escapedSrt = input.srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')
  filterParts.push(
    `[vconcat]subtitles=filename='${escapedSrt}':force_style='FontName=DejaVu Sans,FontSize=${
      width > height ? 22 : 16
    },PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,MarginV=${
      width > height ? 40 : 90
    }'[vout]`
  )

  filterParts.push(`[${voiceIndex}:a]volume=1.0[voice]`)
  if (musicIndex !== null) {
    const duckStart = Math.max(0, totalDuration(input.scenes) - 2)
    filterParts.push(`[${musicIndex}:a]volume=0.12,afade=t=out:st=${duckStart}:d=2[music]`)
    filterParts.push(`[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`)
  } else {
    filterParts.push(`[voice]anull[aout]`)
  }

  args.push(
    '-filter_complex',
    filterParts.join(';'),
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    '-shortest',
    input.outputPath
  )

  await run('ffmpeg', args)
  return { outputPath: input.outputPath }
}

function totalDuration(scenes: SceneInput[]): number {
  return scenes.reduce((sum, s) => sum + s.durationSeconds, 0)
}

export interface ThumbnailOverlayInput {
  backgroundPath: string
  outputPath: string
  text: string
  width: number
  height: number
}

// Composites the bold title text + a bottom gradient over an AI-generated
// text-free background, since diffusion models render legible text poorly.
export async function overlayThumbnailText(input: ThumbnailOverlayInput): Promise<void> {
  const fontPath = process.env.THUMBNAIL_FONT_PATH || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  const fontSize = Math.round(input.width * 0.09)
  const escapedText = input.text.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")

  const filter =
    `[0:v]scale=${input.width}:${input.height}[bg];` +
    `color=black@0.55:s=${input.width}x220[shade];` +
    `[bg][shade]overlay=0:${input.height - 220}[base];` +
    `[base]drawtext=fontfile='${fontPath}':text='${escapedText}':fontcolor=white:fontsize=${fontSize}:` +
    `x=(w-text_w)/2:y=h-180:borderw=6:bordercolor=black@0.8[out]`

  await run('ffmpeg', [
    '-y',
    '-i',
    input.backgroundPath,
    '-filter_complex',
    filter,
    '-map',
    '[out]',
    '-frames:v',
    '1',
    path.resolve(input.outputPath),
  ])
}

export async function probeDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
    ])
    let out = ''
    proc.stdout.on('data', (d) => (out += d.toString()))
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve(parseFloat(out.trim()) || 0)
      else reject(new Error(`ffprobe failed with code ${code}`))
    })
  })
}
