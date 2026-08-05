import type { SupabaseClient } from '@supabase/supabase-js'
import { getProduceVideoQueue } from '@/lib/queue/queues'
import type { UploadPattern, VideoKind } from '@/lib/types'

interface SlotPlan {
  time: string
  kind: VideoKind
}

function slotsForPattern(pattern: UploadPattern, slot1: string, slot2: string, custom: SlotPlan[]): SlotPlan[] {
  switch (pattern) {
    case 'two_shorts':
      return [{ time: slot1, kind: 'short' }, { time: slot2, kind: 'short' }]
    case 'short_and_long':
      return [{ time: slot1, kind: 'short' }, { time: slot2, kind: 'long' }]
    case 'two_long':
      return [{ time: slot1, kind: 'long' }, { time: slot2, kind: 'long' }]
    case 'custom':
      return custom
  }
}

/**
 * Idempotently ensures today's (or a given date's) schedule slots exist
 * for every active, non-paused channel, then enqueues a produce-video job
 * for each slot that doesn't have one yet. Safe to call multiple times a
 * day (e.g. from both a Vercel Cron hit and a manual "run now" button) —
 * the BullMQ job id is derived from the schedule id so re-enqueuing a
 * slot that's already queued/running is a no-op.
 */
export async function ensureScheduleAndEnqueue(supabase: SupabaseClient, date: string) {
  const { data: channels, error } = await supabase
    .from('yt_channels')
    .select('id, is_paused, user_id, yt_channel_settings(*)')
    .eq('status', 'active')
  if (error) throw error

  const userIds = [...new Set((channels ?? []).map((c) => c.user_id))]
  const { data: profiles } = userIds.length
    ? await supabase.from('yt_profiles').select('id, is_paused').in('id', userIds)
    : { data: [] as Array<{ id: string; is_paused: boolean }> }
  const pausedUserIds = new Set((profiles ?? []).filter((p) => p.is_paused).map((p) => p.id))

  const queue = getProduceVideoQueue()
  let enqueued = 0

  for (const channel of channels ?? []) {
    if (channel.is_paused || pausedUserIds.has(channel.user_id)) continue
    const settings = Array.isArray(channel.yt_channel_settings) ? channel.yt_channel_settings[0] : channel.yt_channel_settings
    if (!settings) continue

    const custom: SlotPlan[] = (settings.custom_schedule || []).map((s: any) => ({ time: s.time, kind: s.kind }))
    const slots = slotsForPattern(settings.upload_pattern, settings.slot_time_1, settings.slot_time_2, custom)

    for (const slot of slots) {
      const { data: existing } = await supabase
        .from('yt_schedules')
        .select('id, status')
        .eq('channel_id', channel.id)
        .eq('slot_date', date)
        .eq('slot_time', slot.time)
        .maybeSingle()

      let scheduleId: string
      if (!existing) {
        const { data: created, error: createErr } = await supabase
          .from('yt_schedules')
          .insert({ channel_id: channel.id, slot_date: date, slot_time: slot.time, video_kind: slot.kind, status: 'planned' })
          .select('id')
          .single()
        if (createErr) throw createErr
        scheduleId = created.id
      } else if (existing.status !== 'planned') {
        continue
      } else {
        scheduleId = existing.id
      }

      await queue.add(
        'produce-video',
        { kind: 'produce', channelId: channel.id, scheduleId, videoKind: slot.kind },
        { jobId: `produce-${scheduleId}` }
      )
      enqueued++
    }
  }

  return { channelsChecked: channels?.length ?? 0, enqueued }
}
