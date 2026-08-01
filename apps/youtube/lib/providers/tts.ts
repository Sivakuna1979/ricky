import type { CostEstimate, TTSProvider, TTSResult } from './types'
import type { ProviderSecret } from '@/lib/credentials'

// ElevenLabs — high quality neural TTS with per-word timestamps, which we
// use directly to lay out subtitle cues without a separate forced-aligner.
export class ElevenLabsTTSProvider implements TTSProvider {
  name = 'elevenlabs'
  private apiKey: string
  private baseUrl = 'https://api.elevenlabs.io/v1'

  constructor(secret: ProviderSecret) {
    this.apiKey = secret.apiKey
  }

  async synthesize(text: string, opts: { voiceId: string; speed?: number }): Promise<TTSResult> {
    const res = await fetch(
      `${this.baseUrl}/text-to-speech/${opts.voiceId}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.45, similarity_boost: 0.8, speed: opts.speed ?? 1.0 },
        }),
      }
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`TTS provider (ElevenLabs) request failed: ${res.status} ${body}`)
    }

    const data = await res.json()
    const audioBuffer = Buffer.from(data.audio_base64, 'base64')
    const chars: string[] = data.alignment?.characters ?? []
    const starts: number[] = data.alignment?.character_start_times_seconds ?? []
    const ends: number[] = data.alignment?.character_end_times_seconds ?? []

    const wordTimings = charsToWordTimings(chars, starts, ends)
    const durationSeconds = ends.length ? ends[ends.length - 1] : estimateDuration(text)

    return { audioBuffer, mimeType: 'audio/mpeg', durationSeconds, wordTimings }
  }

  async listVoices() {
    const res = await fetch(`${this.baseUrl}/voices`, { headers: { 'xi-api-key': this.apiKey } })
    if (!res.ok) throw new Error(`Failed to list ElevenLabs voices: ${res.status}`)
    const data = await res.json()
    return (data.voices || []).map((v: any) => ({ id: v.voice_id, label: v.name, language: v.labels?.language || 'en' }))
  }

  estimateCost(characterCount: number): CostEstimate {
    // ElevenLabs "Creator" tier is roughly $0.00018-0.0003 per character depending on plan.
    return { estimatedCostUsd: Number((characterCount * 0.00024).toFixed(4)), unit: 'per-request' }
  }
}

// OpenAI-compatible TTS fallback (no word-level timestamps — subtitles are
// then derived from estimated words-per-second pacing in lib/pipeline/subtitles.ts).
export class OpenAICompatibleTTSProvider implements TTSProvider {
  name = 'openai-compatible'
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor(secret: ProviderSecret) {
    this.apiKey = secret.apiKey
    this.baseUrl = secret.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'
    this.model = secret.model || 'tts-1-hd'
  }

  async synthesize(text: string, opts: { voiceId: string; speed?: number }): Promise<TTSResult> {
    const res = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        voice: opts.voiceId || 'alloy',
        input: text,
        speed: opts.speed ?? 1.0,
        response_format: 'mp3',
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`TTS provider request failed: ${res.status} ${body}`)
    }
    const audioBuffer = Buffer.from(await res.arrayBuffer())
    return { audioBuffer, mimeType: 'audio/mpeg', durationSeconds: estimateDuration(text) }
  }

  async listVoices() {
    return [
      { id: 'alloy', label: 'Alloy', language: 'en' },
      { id: 'echo', label: 'Echo', language: 'en' },
      { id: 'fable', label: 'Fable', language: 'en' },
      { id: 'onyx', label: 'Onyx', language: 'en' },
      { id: 'nova', label: 'Nova', language: 'en' },
      { id: 'shimmer', label: 'Shimmer', language: 'en' },
    ]
  }

  estimateCost(characterCount: number): CostEstimate {
    return { estimatedCostUsd: Number(((characterCount / 1000) * 0.015).toFixed(4)), unit: 'per-request' }
  }
}

function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round((words / 150) * 60)) // ~150 wpm natural narration pace
}

function charsToWordTimings(chars: string[], starts: number[], ends: number[]) {
  const words: Array<{ word: string; startSeconds: number; endSeconds: number }> = []
  let current = ''
  let wordStart: number | null = null
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (/\s/.test(ch)) {
      if (current) {
        words.push({ word: current, startSeconds: wordStart ?? 0, endSeconds: ends[i - 1] ?? 0 })
        current = ''
        wordStart = null
      }
      continue
    }
    if (wordStart === null) wordStart = starts[i] ?? 0
    current += ch
  }
  if (current) {
    words.push({ word: current, startSeconds: wordStart ?? 0, endSeconds: ends[ends.length - 1] ?? 0 })
  }
  return words
}
