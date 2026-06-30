// Voice handling: transcription (speech-to-text) of inbound voice notes and
// optional text-to-speech for replies. Providers are configurable via env so the
// platform is not locked to a single vendor.
//
//   STT_API_URL / STT_API_KEY   – OpenAI-compatible /audio/transcriptions endpoint
//   TTS_API_URL / TTS_API_KEY   – OpenAI-compatible /audio/speech endpoint

export interface MediaFetcher {
  // Returns the raw audio bytes for a provider media url (handles auth headers).
  (url: string): Promise<ArrayBuffer>
}

export async function transcribeAudio(
  audioUrl: string,
  fetcher: MediaFetcher
): Promise<string | null> {
  const apiUrl = process.env.STT_API_URL
  const apiKey = process.env.STT_API_KEY
  if (!apiUrl || !apiKey) {
    return null // Transcription not configured.
  }

  try {
    const bytes = await fetcher(audioUrl)
    const form = new FormData()
    form.append('file', new Blob([bytes]), 'audio.ogg')
    form.append('model', process.env.STT_MODEL ?? 'whisper-1')

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.text ?? null
  } catch {
    return null
  }
}

// Synthesize speech, returning a public URL to the produced audio, or null if
// TTS is not configured. (Storing/serving the audio file is provider specific;
// this returns the upstream response url when the provider gives one.)
export async function synthesizeSpeech(text: string): Promise<string | null> {
  const apiUrl = process.env.TTS_API_URL
  const apiKey = process.env.TTS_API_KEY
  if (!apiUrl || !apiKey) return null

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.TTS_MODEL ?? 'tts-1',
        voice: process.env.TTS_VOICE ?? 'alloy',
        input: text,
      }),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return data?.url ?? null
  } catch {
    return null
  }
}
