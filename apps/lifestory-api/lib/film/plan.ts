import type { FilmScript, NarrationClip, Segment, Timeline } from './types'

export const CROSSFADE = 1.0
const TITLE_SECONDS = 5.5
const END_SECONDS = 6.5
const MIN_PHOTO_SECONDS = 3.2
const NARRATION_LEAD_IN = 0.7 // let the picture settle before the voice starts
const NARRATION_TAIL = 1.3 // a breath after each scene

/**
 * Lay the film out in time. Each scene lasts as long as its narration (plus a breath),
 * split evenly across its photos, and every cut is a crossfade.
 */
export function planTimeline(script: FilmScript, narration: NarrationClip[], photoPath: (id: string) => string): Timeline {
  if (narration.length !== script.scenes.length) throw new Error('Need exactly one narration clip per scene')
  const firstPhoto = script.scenes.find((s) => s.photoIds.length)?.photoIds[0]
  const lastScene = [...script.scenes].reverse().find((s) => s.photoIds.length)
  if (!firstPhoto || !lastScene) throw new Error('The film needs at least one photo')

  const segments: Segment[] = [{ kind: 'title', duration: TITLE_SECONDS, photo: photoPath(firstPhoto), title: script.title, subtitle: script.subtitle }]
  const sceneFirstSegment: number[] = []
  let shot = 0

  script.scenes.forEach((scene, sceneIndex) => {
    const photos = scene.photoIds.length ? scene.photoIds : [lastScene.photoIds[lastScene.photoIds.length - 1]]
    // Visible time of a scene shrinks by one crossfade per cut, so add it back per photo.
    const needed = NARRATION_LEAD_IN + narration[sceneIndex].duration + NARRATION_TAIL
    const perPhoto = Math.max(MIN_PHOTO_SECONDS, needed / photos.length + CROSSFADE)
    sceneFirstSegment.push(segments.length)
    photos.forEach((id, i) => {
      segments.push({
        kind: 'photo',
        duration: round(perPhoto),
        photo: photoPath(id),
        caption: i === 0 ? scene.caption : null,
        sceneIndex,
        zoomIn: shot % 2 === 0,
        pan: ([0, 1, -1] as const)[shot % 3],
      })
      shot++
    })
  })

  const last = lastScene.photoIds[lastScene.photoIds.length - 1]
  segments.push({ kind: 'end', duration: END_SECONDS, photo: photoPath(last), text: script.closing })

  const starts: number[] = []
  let cursor = 0
  for (const seg of segments) {
    starts.push(round(cursor))
    cursor += seg.duration - CROSSFADE
  }
  const total = round(cursor + CROSSFADE)
  const narrationStarts = sceneFirstSegment.map((idx) => round(starts[idx] + CROSSFADE / 2 + NARRATION_LEAD_IN))
  return { segments, starts, narrationStarts, total, crossfade: CROSSFADE }
}

const round = (n: number) => Math.round(n * 1000) / 1000

/** Break text into centred lines for drawtext, which does not wrap on its own. */
export function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.trim().split(/\s+/)) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}
