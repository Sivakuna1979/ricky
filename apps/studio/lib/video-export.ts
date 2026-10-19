'use client'

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { EditState } from './edits'
import { buildFfmpegArgs } from './ffmpeg-args'
import { textOverlayPng } from './render'

let instance: Promise<FFmpeg> | null = null

/** Load ffmpeg.wasm once (≈30 MB, self-hosted from /ffmpeg) and reuse it for every export. */
function loadFfmpeg(): Promise<FFmpeg> {
  if (!instance) {
    instance = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')])
      const ffmpeg = new FFmpeg()
      const base = `${window.location.origin}/ffmpeg`
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      return ffmpeg
    })().catch((err) => {
      instance = null
      throw err
    })
  }
  return instance
}

export type ExportStage = 'loading' | 'encoding' | 'done'

export async function exportVideo(
  file: File,
  state: EditState,
  video: { width: number; height: number; duration: number },
  onProgress: (stage: ExportStage, ratio: number) => void,
): Promise<Blob> {
  onProgress('loading', 0)
  const ffmpeg = await loadFfmpeg()
  const plan = buildFfmpegArgs(state, video)

  const progress = ({ progress }: { progress: number }) => onProgress('encoding', Math.min(1, Math.max(0, progress)))
  ffmpeg.on('progress', progress)
  try {
    await ffmpeg.writeFile('input', new Uint8Array(await file.arrayBuffer()))
    if (plan.hasTextOverlay && state.text) await ffmpeg.writeFile('overlay.png', await textOverlayPng(plan.width, plan.height, state.text))
    onProgress('encoding', 0)
    const code = await ffmpeg.exec(plan.args)
    if (code !== 0) throw new Error('The video could not be encoded. Try a different file or fewer effects.')
    const data = await ffmpeg.readFile('output.mp4')
    onProgress('done', 1)
    return new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/mp4' })
  } finally {
    ffmpeg.off('progress', progress)
    for (const f of ['input', 'overlay.png', 'output.mp4']) await ffmpeg.deleteFile(f).catch(() => {})
  }
}
