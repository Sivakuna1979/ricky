import { describe, expect, it } from 'vitest'
import { applyPatch, applyPreset, cropRect, DEFAULT_STATE } from '@/lib/edits'

describe('applyPatch', () => {
  it('clamps values and ignores nulls', () => {
    const s = applyPatch(DEFAULT_STATE, { adjust: { brightness: 500, contrast: null, blur: -3 }, aspect: null })
    expect(s.adjust.brightness).toBe(100)
    expect(s.adjust.contrast).toBe(0)
    expect(s.adjust.blur).toBe(0)
    expect(s.aspect).toBe('original')
  })

  it('builds on the current state unless reset is set', () => {
    const warm = applyPatch(DEFAULT_STATE, { adjust: { warmth: 30 } })
    expect(applyPatch(warm, { aspect: '1:1' }).adjust.warmth).toBe(30)
    expect(applyPatch(warm, { reset: true, aspect: '1:1' })).toEqual({ ...DEFAULT_STATE, aspect: '1:1' })
  })

  it('normalises rotation to quarter turns', () => {
    expect(applyPatch(DEFAULT_STATE, { rotate: -90 }).rotate).toBe(270)
    expect(applyPatch(DEFAULT_STATE, { rotate: 450 }).rotate).toBe(90)
  })

  it('validates text and removes empty captions', () => {
    const s = applyPatch(DEFAULT_STATE, { text: { content: 'Hi', color: 'red', position: 'top' } })
    expect(s.text).toEqual({ content: 'Hi', position: 'top', size: 'medium', color: '#ffffff' })
    expect(applyPatch(s, { text: { remove: true } }).text).toBeNull()
    expect(applyPatch(s, { text: { content: '   ' } }).text).toBeNull()
  })

  it('keeps trim inside the clip and drops an inverted range', () => {
    const s = applyPatch(DEFAULT_STATE, { trimStart: -5, trimEnd: 99, speed: 10 }, 30)
    expect(s.trimStart).toBe(0)
    expect(s.trimEnd).toBe(30)
    expect(s.speed).toBe(4)
    expect(applyPatch(DEFAULT_STATE, { trimStart: 10, trimEnd: 5 }, 30).trimEnd).toBeNull()
  })
})

describe('presets and crops', () => {
  it('replaces adjustments with the preset look', () => {
    const s = applyPreset({ ...DEFAULT_STATE, adjust: { ...DEFAULT_STATE.adjust, blur: 9 } }, 'mono')
    expect(s.adjust.saturation).toBe(-100)
    expect(s.adjust.blur).toBe(0)
  })

  it('centres crops', () => {
    expect(cropRect(1920, 1080, '9:16')).toEqual({ x: 656, y: 0, w: 608, h: 1080 })
    expect(cropRect(1000, 1000, '16:9')).toEqual({ x: 0, y: 219, w: 1000, h: 563 })
  })
})
