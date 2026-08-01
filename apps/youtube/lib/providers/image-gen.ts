import type { CostEstimate, ImageGenProvider, ImageGenResult } from './types'
import type { ProviderSecret } from '@/lib/credentials'

// OpenAI-compatible image generation (works with OpenAI's Images API or any
// gateway exposing the same /images/generations contract). Used for
// thumbnail backgrounds and generated b-roll graphics that stock footage
// can't cover. Every generated image is an original render, not a copy of
// an existing photo — this keeps it clear of stock-photo licensing issues.
export class OpenAICompatibleImageGenProvider implements ImageGenProvider {
  name = 'openai-compatible'
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor(secret: ProviderSecret) {
    this.apiKey = secret.apiKey
    this.baseUrl = secret.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'
    this.model = secret.model || 'gpt-image-1'
  }

  async generate(prompt: string, opts: { width?: number; height?: number } = {}): Promise<ImageGenResult> {
    const size = pickSize(opts.width, opts.height)
    const res = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, size, n: 1 }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Image generation provider request failed: ${res.status} ${body}`)
    }
    const data = await res.json()
    const item = data?.data?.[0]
    let imageBuffer: Buffer
    if (item?.b64_json) {
      imageBuffer = Buffer.from(item.b64_json, 'base64')
    } else if (item?.url) {
      const imgRes = await fetch(item.url)
      imageBuffer = Buffer.from(await imgRes.arrayBuffer())
    } else {
      throw new Error('Image generation provider returned no image data.')
    }
    return { imageBuffer, mimeType: 'image/png' }
  }

  estimateCost(count: number): CostEstimate {
    // gpt-image-1 standard quality is roughly $0.04-0.08/image depending on size.
    return { estimatedCostUsd: Number((count * 0.06).toFixed(4)), unit: 'per-image' }
  }
}

function pickSize(width?: number, height?: number): string {
  if (!width || !height) return '1536x1024'
  if (height > width) return '1024x1536'
  if (height === width) return '1024x1024'
  return '1536x1024'
}
