import { z } from 'zod'
import { MAX_QUESTIONS, nextInterviewStep } from '@/lib/ai/film-ai'
import { handle, HttpError, loadOwnFilm, requireUser } from '@/lib/server/http'
import { adminClient } from '@/lib/server/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

const Body = z.object({ answer: z.string().trim().max(4000).optional() })

/** Send an answer (or nothing, to start) and get the next interview question. */
export const POST = handle(async (req, { params }) => {
  const userId = await requireUser(req)
  const film = await loadOwnFilm(params.id, userId)
  if (film.status !== 'draft' && film.status !== 'scripted') throw new HttpError(409, 'This film is already being made.')
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new HttpError(400, 'Invalid answer.')

  const history = [...film.interview]
  const last = history[history.length - 1]
  if (parsed.data.answer) {
    // Each answer is a paid Claude call, so stop well after the interview is complete.
    if (history.filter((t) => t.role === 'user').length >= MAX_QUESTIONS + 3) throw new HttpError(429, 'That’s plenty of answers. Tap “Write my film” to continue.')
    if (last?.role !== 'assistant') throw new HttpError(409, 'There is no question waiting for an answer.')
    history.push({ role: 'user', content: parsed.data.answer })
  } else if (last?.role === 'assistant') {
    // Reopening the screen: repeat the waiting question instead of asking a new one.
    return Response.json({ question: last.content, done: false, answered: history.filter((t) => t.role === 'user').length, max: MAX_QUESTIONS })
  }

  const { count } = await adminClient().from('ls_photos').select('id', { count: 'exact', head: true }).eq('film_id', film.id)
  const step = await nextInterviewStep(
    { subjectName: film.subject_name, relation: film.relation, occasion: film.occasion, language: film.language, photoCount: count ?? 0 },
    history,
  )
  history.push({ role: 'assistant', content: step.question })
  const { error } = await adminClient().from('ls_films').update({ interview: history }).eq('id', film.id)
  if (error) throw new HttpError(500, 'Could not save your answer.')
  return Response.json({ question: step.question, done: step.done, answered: history.filter((t) => t.role === 'user').length, max: MAX_QUESTIONS })
})
