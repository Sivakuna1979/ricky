import { join } from 'node:path'
import sharp from 'sharp'

/**
 * Titles and captions are drawn with Pango (through sharp) rather than ffmpeg's drawtext,
 * because Pango shapes every script correctly (Tamil, Hindi, Arabic…), falls back to a
 * system font for scripts the serif doesn't cover, and wraps lines for us.
 */

const FONT_DIR = process.env.FILM_FONT_DIR ?? join(process.cwd(), 'assets', 'fonts')
export const FONTS = {
  title: { family: 'Cormorant Garamond SemiBold', file: join(FONT_DIR, 'CormorantGaramond-SemiBold.ttf'), style: '' },
  italic: { family: 'Cormorant Garamond Medium', file: join(FONT_DIR, 'CormorantGaramond-Italic.ttf'), style: 'Italic ' },
} as const
export type FontRole = keyof typeof FONTS

const escapeMarkup = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** White text with a soft shadow on a transparent PNG, centred and wrapped to `maxWidth`. */
export async function textPng(text: string, opts: { role: FontRole; sizePx: number; maxWidth: number; out: string }) {
  const font = FONTS[opts.role]
  const render = (color: string, alpha = '100%') =>
    sharp({
      text: {
        text: `<span foreground="${color}" fgalpha="${alpha}">${escapeMarkup(text.trim())}</span>`,
        // "Family, Style Size" — the comma stops Pango reading "SemiBold" as a weight and missing the face.
        font: `${font.family}, ${font.style}${opts.sizePx}`,
        fontfile: font.file,
        width: Math.round(opts.maxWidth),
        align: 'centre',
        spacing: Math.round(opts.sizePx * 0.18),
        rgba: true,
        dpi: 72,
        wrap: 'word',
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true })

  const [fg, shadow] = await Promise.all([render('white'), render('black', '60%')])
  const pad = Math.round(opts.sizePx * 0.4)
  const w = fg.info.width + pad * 2
  const drop = Math.round(opts.sizePx * 0.04)
  const h = fg.info.height + pad * 2 + drop
  const blurred = await sharp(shadow.data).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(Math.max(1, opts.sizePx / 14)).png().toBuffer()
  await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: blurred, left: 0, top: drop },
      { input: fg.data, left: pad, top: pad },
    ])
    .png()
    .toFile(opts.out)
  return { width: w, height: h }
}
