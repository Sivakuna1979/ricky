import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImageGenProvider, MusicProvider, StockMediaProvider } from '@/lib/providers/types'
import type { ScriptScene, AspectRatio } from '@/lib/types'
import { recordCost } from './cost'

export interface PlannedAsset {
  sceneIndex: number
  assetType: 'stock_video' | 'stock_image' | 'generated_image'
  storagePath: string
  licenseType: string
  licenseUrl: string | null
  attributionRequired: boolean
  attributionText: string | null
}

async function storeBuffer(supabase: SupabaseClient, path: string, buffer: Buffer, contentType: string) {
  const { error } = await supabase.storage.from('media').upload(path, buffer, { contentType, upsert: true })
  if (error) throw error
  return path
}

export async function planAndFetchVisuals(
  supabase: SupabaseClient,
  providers: { stock: StockMediaProvider; imageGen: ImageGenProvider },
  input: { videoId: string; channelId: string; scenes: ScriptScene[]; aspectRatio: AspectRatio; style: string }
): Promise<PlannedAsset[]> {
  const orientation = input.aspectRatio === '9:16' ? 'portrait' : 'landscape'
  const planned: PlannedAsset[] = []

  for (const scene of input.scenes) {
    const query = scene.visual_direction.split(/[,.]/)[0].slice(0, 80)
    let asset: PlannedAsset | null = null

    try {
      const stockVideos = await providers.stock.searchVideos(query, { orientation })
      const pick = stockVideos[0]
      if (pick) {
        const res = await fetch(pick.downloadUrl)
        const buffer = Buffer.from(await res.arrayBuffer())
        const path = `videos/${input.videoId}/scene-${scene.index}.mp4`
        await storeBuffer(supabase, path, buffer, 'video/mp4')
        asset = {
          sceneIndex: scene.index,
          assetType: 'stock_video',
          storagePath: path,
          licenseType: pick.licenseType,
          licenseUrl: pick.licenseUrl,
          attributionRequired: pick.attributionRequired,
          attributionText: pick.attributionText ?? null,
        }
      }
    } catch {
      // Fall through to stock image, then generated image.
    }

    if (!asset) {
      try {
        const stockImages = await providers.stock.searchImages(query, { orientation })
        const pick = stockImages[0]
        if (pick) {
          const res = await fetch(pick.downloadUrl)
          const buffer = Buffer.from(await res.arrayBuffer())
          const path = `videos/${input.videoId}/scene-${scene.index}.jpg`
          await storeBuffer(supabase, path, buffer, 'image/jpeg')
          asset = {
            sceneIndex: scene.index,
            assetType: 'stock_image',
            storagePath: path,
            licenseType: pick.licenseType,
            licenseUrl: pick.licenseUrl,
            attributionRequired: pick.attributionRequired,
            attributionText: pick.attributionText ?? null,
          }
        }
      } catch {
        // Fall through to generated image.
      }
    }

    if (!asset) {
      const prompt = `${input.style} style illustration, no text overlay, no real recognisable people, depicting: ${scene.visual_direction}`
      const { imageBuffer } = await providers.imageGen.generate(prompt, {
        width: input.aspectRatio === '9:16' ? 1024 : 1536,
        height: input.aspectRatio === '9:16' ? 1536 : 1024,
      })
      const path = `videos/${input.videoId}/scene-${scene.index}-generated.png`
      await storeBuffer(supabase, path, imageBuffer, 'image/png')
      const cost = providers.imageGen.estimateCost(1)
      await recordCost(supabase, {
        channelId: input.channelId,
        videoId: input.videoId,
        stage: 'image_gen',
        provider: providers.imageGen.name,
        estimatedCostUsd: cost.estimatedCostUsd,
      })
      asset = {
        sceneIndex: scene.index,
        assetType: 'generated_image',
        storagePath: path,
        licenseType: 'AI-generated (original work, owned by channel)',
        licenseUrl: null,
        attributionRequired: false,
        attributionText: null,
      }
    }

    planned.push(asset)
  }

  const { error } = await supabase.from('yt_media_assets').insert(
    planned.map((a) => ({
      video_id: input.videoId,
      asset_type: a.assetType,
      provider: a.assetType === 'generated_image' ? providers.imageGen.name : providers.stock.name,
      storage_path: a.storagePath,
      license_type: a.licenseType,
      license_url: a.licenseUrl,
      attribution_required: a.attributionRequired,
      attribution_text: a.attributionText,
      scene_index: a.sceneIndex,
    }))
  )
  if (error) throw error

  return planned
}

export async function planMusic(
  supabase: SupabaseClient,
  music: MusicProvider,
  input: { videoId: string; mood: string; minDurationSeconds: number }
) {
  const tracks = await music.search(input.mood, input.minDurationSeconds)
  const track = tracks[0]
  if (!track) {
    throw new Error(
      `No licensed background music found for mood "${input.mood}" with duration >= ${input.minDurationSeconds}s. ` +
        'Add more tracks to the music-library storage bucket manifest.'
    )
  }

  const { error } = await supabase.from('yt_media_assets').insert({
    video_id: input.videoId,
    asset_type: 'music',
    provider: music.name,
    source_url: track.url,
    license_type: track.licenseType,
    license_url: track.licenseUrl ?? null,
    attribution_required: track.attributionRequired,
    attribution_text: track.attributionText ?? null,
  })
  if (error) throw error

  return track
}
