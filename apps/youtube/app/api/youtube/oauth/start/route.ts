import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl } from '@/lib/youtube/oauth'

// Step 1 of the "connect your channel without giving us your Google
// password" flow: redirect to Google's consent screen. We never see or
// store the user's Google credentials — only the OAuth tokens Google
// issues after they approve access.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
  }

  const state = randomBytes(16).toString('hex')
  const authUrl = buildAuthUrl(`${state}.${user.id}`)

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('yt_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
