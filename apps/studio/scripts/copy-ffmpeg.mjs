// Self-host the ffmpeg.wasm core so video export works without a third-party CDN.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd')
const dest = join(root, 'public', 'ffmpeg')

if (!existsSync(src)) {
  console.warn('[copy-ffmpeg] @ffmpeg/core not installed yet; skipping')
  process.exit(0)
}
mkdirSync(dest, { recursive: true })
for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) copyFileSync(join(src, file), join(dest, file))
console.log('[copy-ffmpeg] copied ffmpeg core to public/ffmpeg')
