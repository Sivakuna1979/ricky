import sharp from 'sharp'
import { z } from 'zod'
import { fixPhotoUse, writeScript } from '@/lib/ai/film-ai'
import { handle, HttpError, loadOwnFilm, requireUser } from '@/lib/server/http'
import { adminClient, BUCKET, type PhotoRow } from '@/lib/server/supabase'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_PHOTOS = 60
const MAX_SCRIPT_ATTEMPTS = 6

/** Claude looks at every photo and the interview, then writes the film. */
export const POST = handle(async (req, { params }) => {
  const userId = await requireUser(req)
  const film = await loadOwnFilm(params.id, userId)
  if (film.status !== 'draft' && film.status !== 'scripted') throw new HttpError(409, 'This film is already being made.')
  if (!film.interview.some((t) => t.role === 'user')) throw new HttpError(400, 'Answer a few interview questions first.')
  if ((film.script_attempts ?? 0) >= MAX_SCRIPT_ATTEMPTS) throw new HttpError(429, 'You’ve rewritten this film several times. Edit the words directly instead.')

  const db = adminClient()
  await db.from('ls_films').update({ script_attempts: (film.script_attempts ?? 0) + 1 }).eq('id', film.id)
  const { data: photos } = await db.from('ls_photos').select('*').eq('film_id', film.id).order('position').limit(MAX_PHOTOS)
  if (!photos?.length) throw new HttpError(400, 'Add some photos first.')

  const thumbs = await Promise.all(
    (photos as PhotoRow[]).map(async (p) => {
      const { data, error } = await db.storage.from(BUCKET).download(p.storage_path)
      if (error || !data) throw new HttpError(500, 'Could not read one of the photos.')
      const jpeg = await sharp(Buffer.from(await data.arrayBuffer())).rotate().resize(512, 512, { fit: 'inside' }).jpeg({ quality: 72 }).toBuffer()
      return { id: p.id, jpegBase64: jpeg.toString('base64'), note: p.note }
    }),
  )

  const script = await writeScript(
    { subjectName: film.subject_name, relation: film.relation, occasion: film.occasion, language: film.language, photoCount: photos.length },
    film.interview,
    thumbs,
  )
  const { error } = await db.from('ls_films').update({ script, status: 'scripted' }).eq('id', film.id)
  if (error) throw new HttpError(500, 'Could not save the script.')
  return Response.json({ script })
})

const ScriptEdit = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(80),
  closing: z.string().trim().max(120),
  musicMood: z.enum(['gentle', 'uplifting', 'nostalgic']),
  scenes: z
    .array(z.object({ photoIds: z.array(z.string()).max(8), narration: z.string().trim().max(800), caption: z.string().trim().max(60).nullable() }))
    .min(1)
    .max(30),
})

/** Save the family's edits to the script. */
export const PUT = handle(async (req, { params }) => {
  const userId = await requireUser(req)
  const film = await loadOwnFilm(params.id, userId)
  if (film.status !== 'scripted') throw new HttpError(409, 'This script can no longer be edited.')
  const parsed = ScriptEdit.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new HttpError(400, 'Some of the script is too long or missing.')
  const { data: photos } = await adminClient().from('ls_photos').select('id').eq('film_id', film.id)
  const script = fixPhotoUse(parsed.data, (photos ?? []).map((p) => p.id as string))
  const { error } = await adminClient().from('ls_films').update({ script }).eq('id', film.id)
  if (error) throw new HttpError(500, 'Could not save your changes.')
  return Response.json({ script })
})
