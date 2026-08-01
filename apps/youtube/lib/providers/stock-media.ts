import type { CostEstimate, StockAsset, StockMediaProvider } from './types'
import type { ProviderSecret } from '@/lib/credentials'

// Pexels: free-to-use, properly licensed stock photos & video under the
// Pexels License (https://www.pexels.com/license/) — usable in this kind
// of commercial video without per-clip royalties, attribution recorded
// anyway for the licence audit trail. Requires the user's own free Pexels
// API key (https://www.pexels.com/api/).
export class PexelsStockMediaProvider implements StockMediaProvider {
  name = 'pexels'
  private apiKey: string
  private baseUrl = 'https://api.pexels.com'

  constructor(secret: ProviderSecret) {
    this.apiKey = secret.apiKey
  }

  async searchVideos(query: string, opts: { orientation?: 'landscape' | 'portrait' } = {}): Promise<StockAsset[]> {
    const url = new URL(`${this.baseUrl}/videos/search`)
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', '6')
    if (opts.orientation) url.searchParams.set('orientation', opts.orientation)

    const res = await fetch(url, { headers: { Authorization: this.apiKey } })
    if (!res.ok) throw new Error(`Pexels video search failed: ${res.status}`)
    const data = await res.json()

    return (data.videos || []).map((v: any) => {
      const file = pickBestVideoFile(v.video_files, opts.orientation)
      return {
        id: `pexels-video-${v.id}`,
        url: v.url,
        downloadUrl: file?.link || v.video_files?.[0]?.link,
        type: 'video' as const,
        width: file?.width || v.width,
        height: file?.height || v.height,
        licenseType: 'Pexels License',
        licenseUrl: 'https://www.pexels.com/license/',
        attributionRequired: false,
        attributionText: `Video by ${v.user?.name} on Pexels`,
      }
    })
  }

  async searchImages(query: string, opts: { orientation?: 'landscape' | 'portrait' } = {}): Promise<StockAsset[]> {
    const url = new URL(`${this.baseUrl}/v1/search`)
    url.searchParams.set('query', query)
    url.searchParams.set('per_page', '6')
    if (opts.orientation) url.searchParams.set('orientation', opts.orientation)

    const res = await fetch(url, { headers: { Authorization: this.apiKey } })
    if (!res.ok) throw new Error(`Pexels image search failed: ${res.status}`)
    const data = await res.json()

    return (data.photos || []).map((p: any) => ({
      id: `pexels-photo-${p.id}`,
      url: p.url,
      downloadUrl: p.src.large2x || p.src.large,
      type: 'image' as const,
      width: p.width,
      height: p.height,
      licenseType: 'Pexels License',
      licenseUrl: 'https://www.pexels.com/license/',
      attributionRequired: false,
      attributionText: `Photo by ${p.photographer} on Pexels`,
    }))
  }

  estimateCost(_count: number): CostEstimate {
    return { estimatedCostUsd: 0, unit: 'free-tier' }
  }
}

function pickBestVideoFile(files: any[], orientation?: 'landscape' | 'portrait') {
  if (!files?.length) return null
  const wantsPortrait = orientation === 'portrait'
  const sorted = [...files].sort((a, b) => {
    const aMatch = wantsPortrait ? a.height > a.width : a.width >= a.height
    const bMatch = wantsPortrait ? b.height > b.width : b.width >= b.height
    if (aMatch !== bMatch) return aMatch ? -1 : 1
    return (b.width * b.height) - (a.width * a.height)
  })
  return sorted.find((f) => f.width <= 1920) || sorted[sorted.length - 1]
}
