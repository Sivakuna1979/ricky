import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, encryptTokens, getOAuthClient } from '@/lib/youtube/oauth'
import { getOwnChannel } from '@/lib/youtube/client'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') || ''
  const error = url.searchParams.get('error')

  const failRedirect = (message: string) =>
    NextResponse.redirect(`${appUrl}/dashboard/channels?error=${encodeURIComponent(message)}`)

  if (error) return failRedirect(`Google denied access: ${error}`)
  if (!code) return failRedirect('Missing authorization code from Google.')

  const [statePart, userId] = state.split('.')
  const expectedState = request.cookies.get('yt_oauth_state')?.value
  if (!expectedState || statePart !== expectedState || !userId) {
    return failRedirect('OAuth state mismatch — please try connecting again.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) {
    return failRedirect('Session expired — please log in and try again.')
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    const client = getOAuthClient()
    client.setCredentials({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken })
    const channel = await getOwnChannel(client)

    const { data: channelRow, error: upsertError } = await supabase
      .from('yt_channels')
      .upsert(
        {
          user_id: user.id,
          youtube_channel_id: channel.id,
          title: channel.title,
          thumbnail_url: channel.thumbnailUrl,
          status: 'active',
          connected_at: new Date().toISOString(),
          ...encryptTokens(tokens),
        },
        { onConflict: 'user_id,youtube_channel_id' }
      )
      .select('id')
      .single()

    if (upsertError) throw upsertError

    // Default channel settings row (Assisted Automation, standard mode) if
    // this is the first time connecting this channel.
    await supabase
      .from('yt_channel_settings')
      .upsert({ channel_id: channelRow.id }, { onConflict: 'channel_id', ignoreDuplicates: true })

    const res = NextResponse.redirect(`${appUrl}/dashboard/channels?connected=${channel.id}`)
    res.cookies.delete('yt_oauth_state')
    return res
  } catch (err) {
    console.error('YouTube OAuth callback failed', err)
    return failRedirect(err instanceof Error ? err.message : 'Failed to connect channel.')
  }
}
