/**
 * Generates the bundled background music: slow, soft piano-like chord beds, written from
 * scratch so there is no licensing question. Run once: `npx tsx scripts/make-music.ts`.
 * Replace or add files in assets/music/ with licensed tracks whenever you like.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RATE = 44100
const OUT = join(process.cwd(), 'assets', 'music')

// MIDI note numbers per chord; each mood loops its progression.
const MOODS: Record<string, { bpm: number; chords: number[][] }> = {
  gentle: { bpm: 56, chords: [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]] }, // C  Am  F  G
  nostalgic: { bpm: 50, chords: [[45, 52, 60, 64], [41, 48, 57, 60], [48, 55, 64, 67], [43, 50, 55, 62]] }, // Am F  C  G
  uplifting: { bpm: 64, chords: [[41, 48, 57, 65], [43, 50, 59, 67], [45, 52, 60, 64], [48, 55, 64, 72]] }, // F  G  Am C
}

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

function render(mood: { bpm: number; chords: number[][] }, seconds: number): Float32Array {
  const out = new Float32Array(seconds * RATE)
  const beat = 60 / mood.bpm
  const bar = beat * 4
  for (let t0 = 0, i = 0; t0 < seconds; t0 += bar, i++) {
    const chord = mood.chords[i % mood.chords.length]
    // Arpeggiate gently: one note per beat, then the full chord rings.
    chord.forEach((note, n) => strike(out, freq(note), t0 + n * beat * 0.5, bar * 1.6, 0.13))
    strike(out, freq(chord[0] - 12), t0, bar * 1.8, 0.16) // soft bass
    if (i % 2 === 1) strike(out, freq(chord[chord.length - 1] + 12), t0 + beat * 2.5, bar, 0.05) // a high sparkle
  }
  return reverb(out)
}

/** A piano-ish tone: a few harmonics with a fast attack and long exponential decay. */
function strike(buf: Float32Array, f: number, start: number, length: number, amp: number) {
  const s0 = Math.floor(start * RATE)
  const n = Math.floor(length * RATE)
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE
    const env = Math.min(1, t / 0.012) * Math.exp(-t * 1.6)
    const w = 2 * Math.PI * f * t
    buf[s0 + i] += amp * env * (Math.sin(w) + 0.35 * Math.sin(2 * w) * Math.exp(-t * 3) + 0.12 * Math.sin(3 * w) * Math.exp(-t * 5))
  }
}

/** Cheap feedback-delay reverb so the notes bloom into each other. */
function reverb(dry: Float32Array): Float32Array {
  const out = Float32Array.from(dry)
  for (const [ms, gain] of [[37, 0.32], [53, 0.28], [79, 0.24], [113, 0.2]] as const) {
    const d = Math.floor((ms / 1000) * RATE)
    for (let i = d; i < out.length; i++) out[i] += out[i - d] * gain * 0.55
  }
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.8
  return out
}

function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

mkdirSync(OUT, { recursive: true })
for (const [name, mood] of Object.entries(MOODS)) {
  const tmp = join(OUT, `${name}.wav`)
  writeFileSync(tmp, wav(render(mood, 120)))
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-af', 'lowpass=f=5000,afade=t=in:d=1', '-ac', '2', '-b:a', '160k', join(OUT, `${name}.mp3`)])
  execFileSync('rm', [tmp])
  console.log('wrote', `${name}.mp3`)
}
