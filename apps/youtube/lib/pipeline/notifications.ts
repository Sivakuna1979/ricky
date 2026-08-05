import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export type NotificationType =
  | 'approval_required'
  | 'video_scheduled'
  | 'video_published'
  | 'upload_failed'
  | 'render_failed'
  | 'copyright_warning'
  | 'policy_warning'
  | 'api_limit_reached'
  | 'spend_limit_reached'

// Email is the Phase-1 channel. The `sent_via` column on yt_notifications
// already stores an array so WhatsApp/push can be appended later without a
// schema change — see notifyChannels below.
export async function notify(
  supabase: SupabaseClient,
  input: { userId: string; type: NotificationType; title: string; body: string; relatedEntity?: Record<string, unknown> }
) {
  const { data: row, error } = await supabase
    .from('yt_notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      related_entity: input.relatedEntity ?? {},
      sent_via: [],
    })
    .select('id')
    .single()
  if (error) throw error

  const sentVia: string[] = []
  const emailSent = await sendEmail(supabase, input.userId, input.title, input.body)
  if (emailSent) sentVia.push('email')

  if (sentVia.length) {
    await supabase.from('yt_notifications').update({ sent_via: sentVia }).eq('id', row.id)
  }
}

async function sendEmail(supabase: SupabaseClient, userId: string, subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false // Notifications still land in-app even if email isn't configured.

  const { data: profile } = await supabase.from('yt_profiles').select('notification_email').eq('id', userId).single()
  const to = profile?.notification_email
  if (!to) return false

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'youtube-automation@notifications.example.com',
    to,
    subject: `[YouTube Automation] ${subject}`,
    text: body,
  })
  return true
}
