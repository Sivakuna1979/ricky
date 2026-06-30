// Shared domain types mirroring the database schema
// (supabase/migrations/20240020_agent_platform.sql).

export type ChannelType = 'whatsapp' | 'telegram'
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'
export type MediaType = 'image' | 'audio' | 'document'

export interface Workspace {
  id: string
  name: string
  owner_id: string
  plan: string
  subscription_status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
}

export interface Agent {
  id: string
  workspace_id: string
  name: string
  system_prompt: string
  model: string
  temperature: number
  voice_enabled: boolean
  tools_enabled: string[]
  created_at: string
}

export interface Channel {
  id: string
  workspace_id: string
  agent_id: string | null
  type: ChannelType
  name: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  external_id: string | null
  credentials: Record<string, string>
  webhook_secret: string
  created_at: string
}

export interface Contact {
  id: string
  workspace_id: string
  channel_id: string
  external_id: string
  name: string | null
  phone: string | null
}

export interface Conversation {
  id: string
  workspace_id: string
  channel_id: string
  agent_id: string | null
  contact_id: string
  status: 'open' | 'closed'
  last_message_at: string
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  workspace_id: string
  role: MessageRole
  content: string
  media_url: string | null
  media_type: MediaType | null
  tokens: number | null
  created_at: string
}

export interface KnowledgeDocument {
  id: string
  workspace_id: string
  agent_id: string | null
  title: string
  content: string
  source: string | null
  created_at: string
}

export interface ScheduledJob {
  id: string
  workspace_id: string
  agent_id: string | null
  channel_id: string | null
  recipient: string | null
  name: string
  prompt: string
  cron: string | null
  run_at: string | null
  next_run_at: string | null
  status: 'scheduled' | 'running' | 'done' | 'error' | 'canceled'
  last_run_at: string | null
  created_at: string
}

// Channel-agnostic representation of an inbound message after normalization.
export interface InboundMessage {
  channelType: ChannelType
  // Stable id of the end user on that channel (phone / chat id).
  fromExternalId: string
  fromName?: string
  text?: string
  // For voice / image / document attachments.
  mediaUrl?: string
  mediaType?: MediaType
  // Provider raw payload, kept for debugging.
  raw?: unknown
}
