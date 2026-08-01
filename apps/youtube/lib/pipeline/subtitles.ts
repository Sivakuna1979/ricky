import type { ScriptScene } from '@/lib/types'

interface WordTiming {
  word: string
  startSeconds: number
  endSeconds: number
}

function formatSrtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const msRem = ms % 1000
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(msRem, 3)}`
}

const MAX_CHARS_PER_CUE = 42
const MAX_WORDS_PER_CUE = 8

// Groups word timings into short, readable subtitle cues (2-8 words,
// under ~42 chars — standard advertiser/accessibility-friendly cue sizing)
// and renders a full SRT file.
export function buildSrtFromWordTimings(wordTimings: WordTiming[]): string {
  const cues: Array<{ start: number; end: number; text: string }> = []
  let current: WordTiming[] = []

  const flush = () => {
    if (!current.length) return
    cues.push({
      start: current[0].startSeconds,
      end: current[current.length - 1].endSeconds,
      text: current.map((w) => w.word).join(' '),
    })
    current = []
  }

  for (const w of wordTimings) {
    const candidateText = [...current, w].map((x) => x.word).join(' ')
    if (current.length >= MAX_WORDS_PER_CUE || candidateText.length > MAX_CHARS_PER_CUE) flush()
    current.push(w)
    if (/[.!?]$/.test(w.word)) flush()
  }
  flush()

  return cues
    .map((cue, i) => `${i + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}\n`)
    .join('\n')
}

// Fallback for TTS providers that don't return word-level timestamps:
// distributes each scene's narration evenly across its planned duration.
export function buildSrtFromScenes(scenes: ScriptScene[]): string {
  const wordTimings: WordTiming[] = []
  let cursor = 0
  for (const scene of scenes) {
    const words = scene.text.trim().split(/\s+/).filter(Boolean)
    const perWord = scene.duration_seconds / Math.max(1, words.length)
    for (const word of words) {
      wordTimings.push({ word, startSeconds: cursor, endSeconds: cursor + perWord })
      cursor += perWord
    }
  }
  return buildSrtFromWordTimings(wordTimings)
}
