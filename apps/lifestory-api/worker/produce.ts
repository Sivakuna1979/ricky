import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { ffmpeg, probeDuration, renderFilm } from '../lib/film/render'
import type { FilmFormat, FilmScript, NarrationClip } from '../lib/film/types'
import { synthesize, type VoiceId } from '../lib/tts'

export interface ProduceInput {
  filmId: string
  userId: string
  script: FilmScript
  format: FilmFormat
  voice: VoiceId
  photos: { id: string; storagePath: string }[]
}

export interface ProduceDeps {
  download: (storagePath: string) => Promise<Buffer>
  upload: (storagePath: string, file: Buffer, contentType: string) => Promise<void>
  progress: (ratio: number) => Promise<void> | void
}

/** Photos + script in, finished film and poster uploaded. Storage is injected so this runs anywhere. */
export async function produceFilm(input: ProduceInput, deps: ProduceDeps) {
  const work = await mkdtemp(join(tmpdir(), `lifestory-${input.filmId.slice(0, 8)}-`))
  try {
    // 1. Photos: honour phone rotation (EXIF), cap the size, re-encode as plain JPEG.
    const localPhoto = new Map<string, string>()
    await Promise.all(
      input.photos.map(async (p) => {
        const out = join(work, `${p.id}.jpg`)
        await sharp(await deps.download(p.storagePath)).rotate().resize(2600, 2600, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#000' }).jpeg({ quality: 90 }).toFile(out)
        localPhoto.set(p.id, out)
      }),
    )
    await deps.progress(0.05)

    // 2. Narration, a few scenes at a time.
    const narration: NarrationClip[] = new Array(input.script.scenes.length)
    let next = 0
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (next < input.script.scenes.length) {
          const i = next++
          const path = join(work, `narration-${i}.mp3`)
          await synthesize(input.script.scenes[i].narration, input.voice, path)
          narration[i] = { path, duration: await probeDuration(path) }
        }
      }),
    )
    await deps.progress(0.15)

    // 3. Render.
    const output = join(work, 'film.mp4')
    const music = join(process.cwd(), 'assets', 'music', `${input.script.musicMood}.mp3`)
    const timeline = await renderFilm({
      script: input.script,
      photoPath: (id) => {
        const p = localPhoto.get(id)
        if (!p) throw new Error(`Photo ${id} is missing`)
        return p
      },
      narration,
      musicPath: existsSync(music) ? music : null,
      format: input.format,
      output,
      onProgress: (r) => void deps.progress(0.15 + r * 0.8),
    })

    // 4. Poster from the first photo (the app shows the title over it), then upload both.
    const poster = join(work, 'poster.jpg')
    const posterAt = (timeline.starts[1] ?? 0) + timeline.crossfade + 1
    await ffmpeg(['-ss', posterAt.toFixed(2), '-i', output, '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '4', poster])
    const base = `${input.userId}/${input.filmId}`
    const videoPath = `${base}/film-${Date.now()}.mp4`
    const posterPath = `${base}/poster-${Date.now()}.jpg`
    await deps.upload(videoPath, await readFile(output), 'video/mp4')
    await deps.upload(posterPath, await readFile(poster), 'image/jpeg')
    return { videoPath, posterPath, duration: timeline.total }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

