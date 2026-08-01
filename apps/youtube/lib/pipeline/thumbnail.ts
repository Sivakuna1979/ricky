import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImageGenProvider } from '@/lib/providers/types'
import type { AspectRatio } from '@/lib/types'
import { recordCost } from './cost'

export interface ThumbnailPlan {
  backgroundPrompt: string
  overlayText: string
}

export function buildThumbnailPrompt(title: string, style: string, highlightVisual: string): ThumbnailPlan {
  // Keep the overlay text short — it gets burned on top separately via
  // ffmpeg drawtext (worker/ffmpeg.ts) so the model never has to render
  // legible text itself, which diffusion image models are unreliable at.
  const words = title.split(/\s+/).slice(0, 5).join(' ')
  return {
    backgroundPrompt: `${style} style, high-contrast, no text, no watermark, no real recognisable celebrity faces, ` +
      `dramatic YouTube-thumbnail composition depicting: ${highlightVisual}`,
    overlayText: words.toUpperCase(),
  }
}

// Generates a text-free background image; the bold overlay text and a
// darkening gradient are composited on top by the worker's ffmpeg step so
// it stays crisp and readable at small sizes (a known weak point of
// diffusion-model text rendering).
export async function generateThumbnailBackground(
  supabase: SupabaseClient,
  imageGen: ImageGenProvider,
  input: { videoId: string; channelId: string; prompt: string; aspectRatio: AspectRatio; variant: string }
) {
  const { imageBuffer } = await imageGen.generate(input.prompt, {
    width: input.aspectRatio === '9:16' ? 1024 : 1536,
    height: input.aspectRatio === '9:16' ? 1536 : 1024,
  })
  const path = `thumbnails/${input.videoId}/bg-${input.variant}.png`
  const { error } = await supabase.storage.from('media').upload(path, imageBuffer, { contentType: 'image/png', upsert: true })
  if (error) throw error

  const cost = imageGen.estimateCost(1)
  await recordCost(supabase, {
    channelId: input.channelId,
    videoId: input.videoId,
    stage: 'thumbnail',
    provider: imageGen.name,
    estimatedCostUsd: cost.estimatedCostUsd,
  })

  return path
}
