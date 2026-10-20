import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

/**
 * Narration voices. The app shows the friendly names; each maps to a provider voice.
 * ElevenLabs is preferred (natural, emotional, speaks Tamil, Hindi and ~30 other languages).
 * OpenAI TTS is the fallback. Override any voice id with an env var.
 */
export const VOICES = {
  warm_female: { label: 'Warm, gentle (female)', elevenlabs: process.env.ELEVENLABS_VOICE_WARM_FEMALE ?? '21m00Tcm4TlvDq8ikWAM', openai: 'shimmer' },
  warm_male: { label: 'Warm, calm (male)', elevenlabs: process.env.ELEVENLABS_VOICE_WARM_MALE ?? 'pNInz6obpgDQGcFmaJgB', openai: 'onyx' },
  storyteller: { label: 'Storyteller (British)', elevenlabs: process.env.ELEVENLABS_VOICE_STORYTELLER ?? 'onwK4e9ZLuTAKqWW03F9', openai: 'fable' },
} as const
export type VoiceId = keyof typeof VOICES

export function ttsProvider(): 'elevenlabs' | 'openai' | 'silent' {
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'silent'
}

/** Speak `text` and write an MP3 to `out`. */
export async function synthesize(text: string, voice: VoiceId, out: string): Promise<void> {
  const v = VOICES[voice] ?? VOICES.warm_female
  const provider = ttsProvider()

  if (provider === 'elevenlabs') {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.elevenlabs}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2',
        // Lower stability = more expressive; a touch slower suits a memorial film.
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.25, speed: 0.92 },
      }),
    })
    if (!res.ok) throw new Error(`Voice-over failed (ElevenLabs ${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`)
    await writeFile(out, Buffer.from(await res.arrayBuffer()))
    return
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts', voice: v.openai, input: text, speed: 0.95, response_format: 'mp3' }),
    })
    if (!res.ok) throw new Error(`Voice-over failed (OpenAI ${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`)
    await writeFile(out, Buffer.from(await res.arrayBuffer()))
    return
  }

  // No voice provider configured (local development): silence of about the right length,
  // so the rest of the pipeline can still be tested end to end.
  const words = text.trim().split(/\s+/).length
  const seconds = Math.max(2, (words / 140) * 60)
  await new Promise<void>((resolve, reject) => {
    const p = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono`, '-t', seconds.toFixed(2), '-b:a', '64k', out])
    p.on('error', reject)
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('Could not create placeholder narration'))))
  })
}
