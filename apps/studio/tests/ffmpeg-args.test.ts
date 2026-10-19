import { execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyPatch, DEFAULT_STATE } from '@/lib/edits'
import { atempoChain, buildFfmpegArgs } from '@/lib/ffmpeg-args'

const video = { width: 1920, height: 1080, duration: 4 }

describe('buildFfmpegArgs', () => {
  it('chains atempo for speeds outside 0.5–2', () => {
    expect(atempoChain(4)).toEqual(['atempo=2', 'atempo=2'])
    expect(atempoChain(0.25)).toEqual(['atempo=0.5', 'atempo=0.5'])
    expect(atempoChain(1)).toEqual([])
  })

  it('produces even output dimensions for a vertical crop', () => {
    const plan = buildFfmpegArgs({ ...DEFAULT_STATE, aspect: '9:16' }, video)
    expect(plan.width % 2).toBe(0)
    expect(plan.height).toBe(1080)
  })

  it('drops audio when muted', () => {
    expect(buildFfmpegArgs({ ...DEFAULT_STATE, volume: 0 }, video).args).toContain('-an')
  })
})

// Runs the generated command through the system ffmpeg to prove the filter graph is valid.
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

describe.skipIf(!hasFfmpeg)('generated command runs in ffmpeg', () => {
  it('encodes a clip with every effect enabled', () => {
    const dir = mkdtempSync(join(tmpdir(), 'studio-'))
    const input = join(dir, 'input.mp4')
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=4', '-f', 'lavfi', '-i', 'sine=duration=4', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', input], { stdio: 'ignore' })
    // 1×1 transparent PNG stands in for the browser-rendered caption overlay.
    const overlay = join(dir, 'overlay.png')
    writeFileSync(overlay, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'))
    const state = applyPatch(
      DEFAULT_STATE,
      { adjust: { brightness: 20, contrast: 10, saturation: -30, warmth: 40, hue: 15, blur: 2, vignette: 50 }, aspect: '9:16', rotate: 90, flipH: true, text: { content: 'Hello' }, trimStart: 0.5, trimEnd: 3, speed: 1.5, volume: 0.5 },
      4,
    )
    const output = join(dir, 'output.mp4')
    const plan = buildFfmpegArgs(state, { width: 640, height: 360, duration: 4 }, { input, overlay, output })
    execFileSync('ffmpeg', ['-y', ...plan.args], { stdio: 'pipe' })
    expect(existsSync(output)).toBe(true)
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'csv=p=0', output]).toString()
    expect(probe).toContain(`${plan.width},${plan.height}`)
    expect(probe).toContain('audio')
  }, 60_000)
})
