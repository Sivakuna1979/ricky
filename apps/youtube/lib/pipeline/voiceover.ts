import type { SupabaseClient } from '@supabase/supabase-js'
import type { TTSProvider } from '@/lib/providers/types'
import { recordCost } from './cost'

export async function generateVoiceover(
  supabase: SupabaseClient,
  tts: TTSProvider,
  input: { scriptId: string; channelId: string; text: string; voiceId: string }
) {
  const { data: voRow, error: insertError } = await supabase
    .from('yt_voiceovers')
    .insert({ script_id: input.scriptId, provider: tts.name, voice_id: input.voiceId, status: 'generating' })
    .select('id')
    .single()
  if (insertError) throw insertError

  try {
    const result = await tts.synthesize(input.text, { voiceId: input.voiceId })
    const storagePath = `voiceovers/${input.scriptId}/${voRow.id}.mp3`

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, result.audioBuffer, { contentType: result.mimeType, upsert: true })
    if (uploadError) throw uploadError

    const cost = tts.estimateCost(input.text.length)

    await supabase
      .from('yt_voiceovers')
      .update({
        storage_path: storagePath,
        duration_seconds: result.durationSeconds,
        word_timings: result.wordTimings ?? [],
        cost_usd: cost.estimatedCostUsd,
        status: 'ready',
      })
      .eq('id', voRow.id)

    await recordCost(supabase, {
      channelId: input.channelId,
      topicId: null,
      stage: 'voiceover',
      provider: tts.name,
      estimatedCostUsd: cost.estimatedCostUsd,
    })

    return {
      voiceoverId: voRow.id as string,
      storagePath,
      durationSeconds: result.durationSeconds,
      wordTimings: result.wordTimings ?? [],
    }
  } catch (err) {
    await supabase
      .from('yt_voiceovers')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : String(err) })
      .eq('id', voRow.id)
    throw err
  }
}
