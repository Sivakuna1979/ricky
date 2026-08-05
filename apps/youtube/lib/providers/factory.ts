import type { SupabaseClient } from '@supabase/supabase-js'
import { getProviderCredential } from '@/lib/credentials'
import { OpenAICompatibleScriptAIProvider } from './script-ai'
import { SerperResearchProvider } from './research'
import { ElevenLabsTTSProvider, OpenAICompatibleTTSProvider } from './tts'
import { OpenAICompatibleImageGenProvider } from './image-gen'
import { PexelsStockMediaProvider } from './stock-media'
import { LibraryMusicProvider } from './music'
import type {
  ImageGenProvider,
  MusicProvider,
  ResearchProvider,
  ScriptAIProvider,
  StockMediaProvider,
  TTSProvider,
} from './types'

export class ProviderNotConfiguredError extends Error {
  constructor(public providerType: string) {
    super(
      `No "${providerType}" provider is configured yet. Add an API key on the Provider Settings ` +
        'page before this pipeline stage can run.'
    )
    this.name = 'ProviderNotConfiguredError'
  }
}

export async function getScriptAIProvider(supabase: SupabaseClient, userId: string): Promise<ScriptAIProvider> {
  const secret = await getProviderCredential(supabase, userId, 'script_ai', 'openai')
  if (!secret) throw new ProviderNotConfiguredError('script_ai')
  return new OpenAICompatibleScriptAIProvider(secret)
}

export async function getResearchProvider(supabase: SupabaseClient, userId: string): Promise<ResearchProvider> {
  const secret = await getProviderCredential(supabase, userId, 'research', 'serper')
  if (!secret) throw new ProviderNotConfiguredError('research')
  return new SerperResearchProvider(secret)
}

export async function getTTSProvider(supabase: SupabaseClient, userId: string): Promise<TTSProvider> {
  const elevenlabs = await getProviderCredential(supabase, userId, 'tts', 'elevenlabs')
  if (elevenlabs) return new ElevenLabsTTSProvider(elevenlabs)
  const openai = await getProviderCredential(supabase, userId, 'tts', 'openai')
  if (openai) return new OpenAICompatibleTTSProvider(openai)
  throw new ProviderNotConfiguredError('tts')
}

export async function getImageGenProvider(supabase: SupabaseClient, userId: string): Promise<ImageGenProvider> {
  const secret = await getProviderCredential(supabase, userId, 'image_gen', 'openai')
  if (!secret) throw new ProviderNotConfiguredError('image_gen')
  return new OpenAICompatibleImageGenProvider(secret)
}

export async function getStockMediaProvider(supabase: SupabaseClient, userId: string): Promise<StockMediaProvider> {
  const secret = await getProviderCredential(supabase, userId, 'stock_video', 'pexels')
  if (!secret) throw new ProviderNotConfiguredError('stock_video')
  return new PexelsStockMediaProvider(secret)
}

export async function getMusicProvider(supabase: SupabaseClient, _userId: string): Promise<MusicProvider> {
  // Uses the shared music-library storage bucket rather than a per-user API key.
  return new LibraryMusicProvider(supabase)
}
