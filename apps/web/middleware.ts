// @ts-nocheck
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)
  // Phase N — request correlation id. Reuse an inbound id (e.g. from a
  // load balancer/log pipeline) when present, otherwise mint one, and echo
  // it on the response so it can be matched against log.info({requestId})
  // lines and against Vercel's own request logs.
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  response.headers.set('x-request-id', requestId)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
