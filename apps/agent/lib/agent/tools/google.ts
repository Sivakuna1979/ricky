import { createAdminClient } from '@/lib/supabase/server'

// Google Workspace tools (Gmail, Calendar, Sheets, Drive) using OAuth tokens
// stored per workspace in the `integrations` table. Tokens are refreshed
// transparently when expired.

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
  'openid',
  'email',
  'profile',
]

async function getAccessToken(workspaceId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: integ } = await supabase
    .from('integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'google')
    .maybeSingle()

  if (!integ) return null

  const expired = integ.expiry && new Date(integ.expiry).getTime() < Date.now() + 60_000
  if (!expired) return integ.access_token

  // Refresh.
  if (!integ.refresh_token) return integ.access_token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: integ.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return integ.access_token
  const tok = await res.json()

  await supabase
    .from('integrations')
    .update({
      access_token: tok.access_token,
      expiry: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', integ.id)

  return tok.access_token
}

export async function googleConnected(workspaceId: string): Promise<boolean> {
  return (await getAccessToken(workspaceId)) != null
}

export async function sendGmail(
  workspaceId: string,
  to: string,
  subject: string,
  body: string
): Promise<string> {
  const token = await getAccessToken(workspaceId)
  if (!token) return 'Google Workspace is not connected.'

  const raw = btoa(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  return res.ok ? `Email sent to ${to}.` : `Failed to send email (${res.status}).`
}

export async function createCalendarEvent(
  workspaceId: string,
  summary: string,
  startIso: string,
  endIso: string,
  description?: string
): Promise<string> {
  const token = await getAccessToken(workspaceId)
  if (!token) return 'Google Workspace is not connected.'

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: startIso },
        end: { dateTime: endIso },
      }),
    }
  )
  if (!res.ok) return `Failed to create event (${res.status}).`
  const data = await res.json()
  return `Event created: ${data.htmlLink ?? summary}.`
}

export async function appendToSheet(
  workspaceId: string,
  spreadsheetId: string,
  range: string,
  values: string[][]
): Promise<string> {
  const token = await getAccessToken(workspaceId)
  if (!token) return 'Google Workspace is not connected.'

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  )
  return res.ok ? 'Row(s) appended to sheet.' : `Failed to append to sheet (${res.status}).`
}

export async function listDriveFiles(workspaceId: string, query: string): Promise<string> {
  const token = await getAccessToken(workspaceId)
  if (!token) return 'Google Workspace is not connected.'

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name contains '${query.replace(/'/g, '')}'`
    )}&pageSize=10&fields=files(name,webViewLink,mimeType)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return `Failed to search Drive (${res.status}).`
  const data = await res.json()
  const files: any[] = data?.files ?? []
  if (!files.length) return 'No matching files in Drive.'
  return files.map((f) => `- ${f.name}: ${f.webViewLink}`).join('\n')
}
