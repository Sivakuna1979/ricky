/**
 * Render worker. Runs as a long-lived process next to ffmpeg (see Dockerfile / Railway):
 * takes the oldest queued film, makes it, uploads it and notifies the family's phone.
 *   npm run worker
 */
import { adminClient, BUCKET, type FilmRow } from '../lib/server/supabase'
import type { VoiceId } from '../lib/tts'
import { produceFilm } from './produce'

const IDLE_MS = Number(process.env.WORKER_IDLE_MS ?? 5000)
let stopping = false
process.on('SIGTERM', () => (stopping = true))
process.on('SIGINT', () => (stopping = true))

async function main() {
  console.log('[worker] Life Story render worker started')
  while (!stopping) {
    const film = await claim().catch((err) => {
      console.error('[worker] claim failed', err)
      return null
    })
    if (!film) {
      await sleep(IDLE_MS)
      continue
    }
    await processFilm(film)
  }
  console.log('[worker] stopped')
}

async function claim(): Promise<FilmRow | null> {
  const { data, error } = await adminClient().rpc('ls_claim_film')
  if (error) throw error
  return (data as FilmRow[] | null)?.[0] ?? null
}

async function processFilm(film: FilmRow) {
  const db = adminClient()
  const started = Date.now()
  console.log(`[worker] rendering ${film.id} (${film.subject_name})`)
  let lastSaved = 0
  try {
    if (!film.script) throw new Error('The film has no script')
    const { data: photos, error } = await db.from('ls_photos').select('id, storage_path').eq('film_id', film.id)
    if (error) throw error
    const result = await produceFilm(
      {
        filmId: film.id,
        userId: film.user_id,
        script: film.script,
        format: film.format,
        voice: film.voice as VoiceId,
        photos: (photos ?? []).map((p) => ({ id: p.id as string, storagePath: p.storage_path as string })),
      },
      {
        download: async (path) => {
          const { data, error } = await db.storage.from(BUCKET).download(path)
          if (error || !data) throw new Error(`Could not download ${path}`)
          return Buffer.from(await data.arrayBuffer())
        },
        upload: async (path, file, contentType) => {
          const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType, upsert: true })
          if (error) throw new Error(`Upload failed: ${error.message}`)
        },
        progress: async (ratio) => {
          if (Date.now() - lastSaved < 3000) return // don't hammer the database
          lastSaved = Date.now()
          await db.from('ls_films').update({ progress: Math.round(ratio * 100) / 100 }).eq('id', film.id)
        },
      },
    )
    await db
      .from('ls_films')
      .update({ status: 'ready', progress: 1, video_path: result.videoPath, poster_path: result.posterPath, duration_seconds: result.duration })
      .eq('id', film.id)
    console.log(`[worker] ${film.id} ready in ${((Date.now() - started) / 1000).toFixed(0)}s`)
    await notify(film.user_id, 'Your film is ready 🎬', `${film.script.title} is ready to watch and share.`, film.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[worker] ${film.id} failed:`, message)
    await db.from('ls_films').update({ status: 'failed', error: message.slice(0, 500) }).eq('id', film.id)
    await notify(film.user_id, 'Your film needs attention', 'Something went wrong while making your film. Open the app to try again — you will not be charged twice.', film.id)
  }
}

/** Expo push notifications; no extra keys needed. */
async function notify(userId: string, title: string, body: string, filmId: string) {
  const { data } = await adminClient().from('ls_devices').select('expo_push_token').eq('user_id', userId)
  const messages = (data ?? []).map((d) => ({ to: d.expo_push_token, title, body, sound: 'default', data: { filmId } }))
  if (!messages.length) return
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  }).catch((err) => console.error('[worker] push failed', err))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
