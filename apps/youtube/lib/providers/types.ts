// Provider interfaces. Every concrete implementation is swappable —
// nothing in the pipeline imports a vendor SDK directly, it only ever
// talks to these interfaces. Which vendor backs each interface is
// chosen per-user on the Provider Settings page (lib/credentials.ts)
// and resolved at runtime by lib/providers/factory.ts.

export interface CostEstimate {
  estimatedCostUsd: number
  unit: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ScriptAIProvider {
  name: string
  /** Free-form chat completion, used for topic ideation, scripts, quality review, metadata. */
  complete(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number; json?: boolean }): Promise<string>
  estimateCost(inputChars: number, outputChars: number): CostEstimate
}

export interface ResearchResult {
  url: string
  title: string
  snippet: string
  publisher?: string
  publishedAt?: string
}

export interface ResearchProvider {
  name: string
  search(query: string, opts?: { recency?: 'day' | 'week' | 'month' | 'year' | 'any' }): Promise<ResearchResult[]>
  estimateCost(queries: number): CostEstimate
}

export interface TTSResult {
  audioBuffer: Buffer
  mimeType: string
  durationSeconds: number
  wordTimings?: Array<{ word: string; startSeconds: number; endSeconds: number }>
}

export interface TTSProvider {
  name: string
  synthesize(text: string, opts: { voiceId: string; speed?: number }): Promise<TTSResult>
  listVoices(): Promise<Array<{ id: string; label: string; language: string }>>
  estimateCost(characterCount: number): CostEstimate
}

export interface ImageGenResult {
  imageBuffer: Buffer
  mimeType: string
}

export interface ImageGenProvider {
  name: string
  generate(prompt: string, opts?: { width?: number; height?: number }): Promise<ImageGenResult>
  estimateCost(count: number): CostEstimate
}

export interface StockAsset {
  id: string
  url: string
  downloadUrl: string
  type: 'video' | 'image'
  width: number
  height: number
  licenseType: string
  licenseUrl: string
  attributionRequired: boolean
  attributionText?: string
}

export interface StockMediaProvider {
  name: string
  searchVideos(query: string, opts?: { orientation?: 'landscape' | 'portrait' }): Promise<StockAsset[]>
  searchImages(query: string, opts?: { orientation?: 'landscape' | 'portrait' }): Promise<StockAsset[]>
  estimateCost(count: number): CostEstimate
}

export interface MusicAsset {
  id: string
  title: string
  url: string
  durationSeconds: number
  mood: string[]
  licenseType: string
  licenseUrl?: string
  attributionRequired: boolean
  attributionText?: string
}

export interface MusicProvider {
  name: string
  search(mood: string, minDurationSeconds: number): Promise<MusicAsset[]>
  estimateCost(count: number): CostEstimate
}
