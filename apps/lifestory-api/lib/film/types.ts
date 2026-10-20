/** What Claude writes and the family can edit before rendering. */
export interface FilmScript {
  title: string // e.g. "Amma"
  subtitle: string // e.g. "1941 – 2025" or "Eighty years of love"
  scenes: FilmScene[]
  closing: string // end card, e.g. "With love, from all of us"
  musicMood: MusicMood
}

export interface FilmScene {
  photoIds: string[] // 1–4 photos shown while this narration plays
  narration: string // what the narrator says
  caption: string | null // small on-screen label, e.g. "Madurai, 1962"
}

export type MusicMood = 'gentle' | 'uplifting' | 'nostalgic'
export type FilmFormat = 'landscape' | 'portrait'

export const FORMATS: Record<FilmFormat, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 }, // TVs and projectors at family events
  portrait: { width: 1080, height: 1920 }, // phones, WhatsApp status, Reels
}

/** A finished narration clip for one scene. */
export interface NarrationClip {
  path: string
  duration: number // seconds
}

export type Segment =
  | { kind: 'title'; duration: number; photo: string; title: string; subtitle: string }
  | { kind: 'photo'; duration: number; photo: string; caption: string | null; sceneIndex: number; zoomIn: boolean; pan: -1 | 0 | 1 }
  | { kind: 'end'; duration: number; photo: string; text: string }

export interface Timeline {
  segments: Segment[]
  /** Start time of each segment in the finished film (crossfades overlap neighbouring segments). */
  starts: number[]
  /** When each scene's narration should begin, in seconds from the start of the film. */
  narrationStarts: number[]
  total: number
  crossfade: number
}
