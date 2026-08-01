// Shared domain types for the YouTube automation platform.
// Mirrors supabase/migrations/20240040_youtube_platform_schema.sql.

export type ApprovalMode = 'manual' | 'assisted' | 'full_auto'
export type ProductionMode = 'low_cost' | 'standard' | 'premium'
export type UploadPattern = 'two_shorts' | 'short_and_long' | 'two_long' | 'custom'
export type VideoType =
  | 'explainer'
  | 'list'
  | 'educational'
  | 'story'
  | 'product_comparison'
  | 'news'
export type VideoKind = 'short' | 'long'
export type AspectRatio = '9:16' | '16:9'

export type ProviderType =
  | 'script_ai'
  | 'research'
  | 'tts'
  | 'image_gen'
  | 'stock_video'
  | 'stock_image'
  | 'music'
  | 'youtube_oauth'
  | 'email'
  | 'moderation'

export type PipelineStage =
  | 'topic_discovery'
  | 'topic_scoring'
  | 'duplicate_check'
  | 'research'
  | 'source_verification'
  | 'script_generation'
  | 'script_quality_review'
  | 'voice_generation'
  | 'visual_planning'
  | 'video_rendering'
  | 'subtitles'
  | 'thumbnail_creation'
  | 'metadata_generation'
  | 'copyright_policy_check'
  | 'upload'
  | 'schedule'
  | 'performance_tracking'
  | 'optimisation'

export interface NicheScores {
  search_demand_score: number
  competition_score: number
  advertiser_suitability_score: number
  production_difficulty_score: number
  evergreen_score: number
  originality_potential_score: number
  copyright_risk_score: number
  retention_potential_score: number
  uk_intl_potential_score: number
}

export const SENSITIVE_NICHE_CATEGORIES = [
  'medical',
  'legal',
  'financial',
  'political',
  'tragic_event',
  'celebrity_rumour',
  'childrens_content',
] as const
export type SensitiveNicheCategory = (typeof SENSITIVE_NICHE_CATEGORIES)[number]

export interface ScriptScene {
  index: number
  text: string
  visual_direction: string
  on_screen_text?: string
  duration_seconds: number
}

export interface ScoreBreakdown {
  search_demand: number
  competition: number
  advertiser_suitability: number
  production_difficulty: number
  evergreen_potential: number
  originality_potential: number
  copyright_risk: number
  retention_potential: number
  uk_intl_potential: number
  total: number
}

export interface Chapter {
  time_seconds: number
  title: string
}

// Weights used when combining niche/topic sub-scores into an overall
// score out of 100. Copyright risk and production difficulty are
// inverted (lower risk/difficulty = higher contribution).
export const SCORE_WEIGHTS = {
  search_demand: 0.16,
  competition: 0.1,
  advertiser_suitability: 0.14,
  production_difficulty: 0.08,
  evergreen_potential: 0.12,
  originality_potential: 0.14,
  copyright_risk: 0.1,
  retention_potential: 0.12,
  uk_intl_potential: 0.04,
} as const
