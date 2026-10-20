import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { produceFilm } from '../worker/produce'

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

// Full pipeline with in-memory storage and placeholder (silent) narration.
describe.skipIf(!hasFfmpeg)('produceFilm', () => {
  it('turns photos and a script into an uploaded MP4 and poster', async () => {
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.OPENAI_API_KEY
    const dir = mkdtempSync(join(tmpdir(), 'ls-test-'))
    const store = new Map<string, Buffer>()
    for (const [id, src] of [['p1', 'testsrc2=size=800x600'], ['p2', 'mandelbrot=size=500x700']]) {
      const f = join(dir, `${id}.jpg`)
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', src, '-frames:v', '1', f])
      store.set(`u/f/${id}.jpg`, readFileSync(f))
    }
    const uploads: Record<string, string> = {}
    const progress: number[] = []
    const result = await produceFilm(
      {
        filmId: '00000000-0000-0000-0000-000000000001',
        userId: 'u',
        format: 'portrait',
        voice: 'warm_female',
        photos: [{ id: 'p1', storagePath: 'u/f/p1.jpg' }, { id: 'p2', storagePath: 'u/f/p2.jpg' }],
        script: {
          title: 'Appa',
          subtitle: 'சென்னை',
          closing: 'With love',
          musicMood: 'gentle',
          scenes: [{ photoIds: ['p1', 'p2'], narration: 'He loved the sea and the smell of rain.', caption: 'Chennai, 1970' }],
        },
      },
      {
        download: async (p) => store.get(p)!,
        upload: async (p, buf, type) => void (uploads[p] = `${type}:${buf.length}`),
        progress: (r) => void progress.push(r),
      },
    )
    expect(result.videoPath).toMatch(/^u\/0{8}.*\/film-\d+\.mp4$/)
    expect(uploads[result.videoPath]).toMatch(/^video\/mp4:\d+/)
    expect(uploads[result.posterPath]).toMatch(/^image\/jpeg:\d+/)
    expect(result.duration).toBeGreaterThan(12)
    expect(progress.at(-1)).toBeGreaterThan(0.9)
  }, 240_000)
})
