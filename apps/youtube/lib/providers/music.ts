import type { SupabaseClient } from '@supabase/supabase-js'
import type { CostEstimate, MusicAsset, MusicProvider } from './types'

// There is no reliable public API for the big licensed-music libraries
// (Epidemic Sound, Artlist, Musicbed, ...) that would let this run fully
// unattended — those require a manual per-track licence agreement. So the
// MVP's music provider is a self-hosted licence library: you upload
// royalty-free / Creative-Commons / YouTube-Audio-Library tracks into the
// Supabase Storage bucket `music-library`, plus one JSON manifest entry
// per track recording where it came from and under what licence. The
// pipeline only ever picks tracks from this recorded, licence-checked set
// — it never downloads music from the open web.
//
// MANUAL SETUP REQUIRED: populate `music-library/manifest.json` (see
// apps/youtube/SETUP.md) before Full Automation can pass the copyright
// gate for background music.
export class LibraryMusicProvider implements MusicProvider {
  name = 'music-library'
  constructor(private supabase: SupabaseClient) {}

  async search(mood: string, minDurationSeconds: number): Promise<MusicAsset[]> {
    const { data: manifestFile, error } = await this.supabase.storage
      .from('music-library')
      .download('manifest.json')

    if (error || !manifestFile) {
      throw new Error(
        'No music library manifest found. Upload licensed tracks and a manifest.json to the ' +
          '"music-library" storage bucket (see SETUP.md) before rendering can select background music.'
      )
    }

    const manifest: MusicAsset[] = JSON.parse(await manifestFile.text())
    const moodLower = mood.toLowerCase()

    const candidates = manifest.filter(
      (t) => t.durationSeconds >= minDurationSeconds && t.mood.some((m) => m.toLowerCase().includes(moodLower))
    )
    return (candidates.length ? candidates : manifest.filter((t) => t.durationSeconds >= minDurationSeconds)).slice(0, 5)
  }

  estimateCost(_count: number): CostEstimate {
    return { estimatedCostUsd: 0, unit: 'pre-licensed' }
  }
}
