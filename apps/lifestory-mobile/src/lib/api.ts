import { config } from './config'
import { supabase } from './supabase'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** Calls the Life Story API with the signed-in user's token. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`${config.apiUrl}${path}`, {
    method: init.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? 'Something went wrong. Please try again.')
  return json as T
}
