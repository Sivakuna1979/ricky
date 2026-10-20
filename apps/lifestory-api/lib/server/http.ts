import { adminClient, type FilmRow } from './supabase'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** The app sends the signed-in user's Supabase access token as a Bearer token. */
export async function requireUser(req: Request): Promise<string> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Please sign in again.')
  const { data, error } = await adminClient().auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Please sign in again.')
  return data.user.id
}

export async function loadOwnFilm(filmId: string, userId: string): Promise<FilmRow> {
  if (!/^[0-9a-f-]{36}$/i.test(filmId)) throw new HttpError(404, 'Film not found.')
  const { data, error } = await adminClient().from('ls_films').select('*').eq('id', filmId).eq('user_id', userId).maybeSingle()
  if (error) throw new HttpError(500, 'Could not load the film.')
  if (!data) throw new HttpError(404, 'Film not found.')
  return data as FilmRow
}

export function handle(fn: (req: Request, ctx: { params: Record<string, string> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Record<string, string> }) => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status })
      console.error('[api]', err)
      return Response.json({ error: err instanceof Error ? err.message : 'Something went wrong.' }, { status: 500 })
    }
  }
}
