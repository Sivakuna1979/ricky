import { z } from 'zod'
import { handle, HttpError, loadOwnFilm, requireUser } from '@/lib/server/http'
import { claimPurchase } from '@/lib/server/payments'
import { adminClient } from '@/lib/server/supabase'
import { VOICES } from '@/lib/tts'

export const runtime = 'nodejs'

const Body = z.object({
  format: z.enum(['landscape', 'portrait']).optional(),
  voice: z.enum(Object.keys(VOICES) as [keyof typeof VOICES, ...(keyof typeof VOICES)[]]).optional(),
})

/** After payment, queue the film for the render worker. */
export const POST = handle(async (req, { params }) => {
  const userId = await requireUser(req)
  const film = await loadOwnFilm(params.id, userId)
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new HttpError(400, 'Invalid options.')

  // A failed render can be retried for free with the same purchase.
  if (film.status === 'failed' && film.purchase_id) {
    await adminClient().from('ls_films').update({ status: 'queued', error: null, ...parsed.data }).eq('id', film.id)
    return Response.json({ status: 'queued' })
  }
  if (film.status !== 'scripted' || !film.script) throw new HttpError(409, 'Finish the script before making the film.')

  const purchaseId = await claimPurchase(userId, film.id)
  const { error } = await adminClient()
    .from('ls_films')
    .update({ status: 'queued', purchase_id: purchaseId, progress: 0, error: null, ...parsed.data })
    .eq('id', film.id)
    .eq('status', 'scripted')
  if (error) throw new HttpError(error.code === '23505' ? 402 : 500, error.code === '23505' ? 'That purchase was already used.' : 'Could not start the film.')
  return Response.json({ status: 'queued' })
})
