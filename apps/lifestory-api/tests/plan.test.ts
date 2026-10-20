import { describe, expect, it } from 'vitest'
import { fixPhotoUse } from '@/lib/ai/film-ai'
import { CROSSFADE, planTimeline } from '@/lib/film/plan'
import type { FilmScript } from '@/lib/film/types'

const script: FilmScript = {
  title: 'Amma',
  subtitle: '1941 – 2025',
  closing: 'With love',
  musicMood: 'gentle',
  scenes: [
    { photoIds: ['a'], narration: 'One.', caption: 'Madurai, 1962' },
    { photoIds: ['b', 'c'], narration: 'Two.', caption: null },
  ],
}

describe('planTimeline', () => {
  const tl = planTimeline(script, [{ path: 'n0', duration: 6 }, { path: 'n1', duration: 10 }], (id) => `/p/${id}.jpg`)

  it('adds a title card, one segment per photo and an end card', () => {
    expect(tl.segments.map((s) => s.kind)).toEqual(['title', 'photo', 'photo', 'photo', 'end'])
    expect(tl.segments[1]).toMatchObject({ caption: 'Madurai, 1962', photo: '/p/a.jpg' })
    expect(tl.segments[3]).toMatchObject({ caption: null })
  })

  it('gives every scene room for its narration', () => {
    const scene2Visible = tl.segments.filter((s) => s.kind === 'photo' && s.sceneIndex === 1).reduce((t, s) => t + s.duration - CROSSFADE, 0)
    expect(scene2Visible).toBeGreaterThanOrEqual(10)
    // Narration starts after the scene's first photo has faded in, and scene 2 starts after scene 1 ends.
    expect(tl.narrationStarts[0]).toBeGreaterThan(tl.starts[1])
    expect(tl.narrationStarts[1]).toBeGreaterThan(tl.narrationStarts[0] + 6)
  })

  it('accounts for crossfade overlap in the total length', () => {
    const sum = tl.segments.reduce((t, s) => t + s.duration, 0)
    expect(tl.total).toBeCloseTo(sum - CROSSFADE * (tl.segments.length - 1), 2)
  })
})

describe('fixPhotoUse', () => {
  it('drops unknown and duplicate photos and places forgotten ones', () => {
    const fixed = fixPhotoUse(
      { ...script, scenes: [{ photoIds: ['a', 'zzz', 'a'], narration: 'x', caption: '' }, { photoIds: ['b'], narration: 'y', caption: 'ok' }] },
      ['a', 'b', 'c'],
    )
    const all = fixed.scenes.flatMap((s) => s.photoIds).sort()
    expect(all).toEqual(['a', 'b', 'c'])
    expect(fixed.scenes[0].caption).toBeNull()
  })
})
