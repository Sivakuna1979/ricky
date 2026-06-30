// Subscription plans. Mirrors the pricing card: WhatsApp + Telegram, AI agents,
// voice, Google Workspace, web search + image generation, scheduled jobs,
// knowledge base, conversation history retention and support tier.

export type PlanId = 'free' | 'starter' | 'pro' | 'business'

export interface Plan {
  id: PlanId
  name: string
  priceMonthly: number // in the smallest currency unit's major form (e.g. USD)
  // Stripe price id, set per environment. Free plan has none.
  stripePriceEnv?: string
  features: string[]
  limits: {
    channels: number
    agents: number
    monthlyMessages: number
    historyDays: number
    voice: boolean
    googleWorkspace: boolean
    webSearch: boolean
    imageGeneration: boolean
    scheduledJobs: boolean
    knowledgeBase: boolean
    prioritySupport: boolean
  }
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    features: ['1 Telegram channel', '1 AI agent', '100 messages / month', '7-day history'],
    limits: {
      channels: 1,
      agents: 1,
      monthlyMessages: 100,
      historyDays: 7,
      voice: false,
      googleWorkspace: false,
      webSearch: false,
      imageGeneration: false,
      scheduledJobs: false,
      knowledgeBase: true,
      prioritySupport: false,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 15,
    stripePriceEnv: 'STRIPE_PRICE_STARTER',
    features: [
      'WhatsApp + Telegram channels',
      '1 channel',
      '1 AI agent',
      '1,000 messages / month',
      '30-day history',
      'Knowledge base',
    ],
    limits: {
      channels: 1,
      agents: 1,
      monthlyMessages: 1000,
      historyDays: 30,
      voice: false,
      googleWorkspace: false,
      webSearch: true,
      imageGeneration: false,
      scheduledJobs: true,
      knowledgeBase: true,
      prioritySupport: false,
    },
  },
  // The "Choose Pro" plan from the pricing card.
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 39,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    features: [
      'WhatsApp + Telegram channels',
      '1 channel',
      '1 AI agent',
      'Voice-based conversations',
      'Google Workspace (Gmail, Calendar, Sheets, Drive)',
      'Web search + image generation',
      'Scheduled reminders & jobs',
      'Knowledge base',
      '90-day conversation history',
      'Priority email support',
    ],
    limits: {
      channels: 1,
      agents: 1,
      monthlyMessages: 10000,
      historyDays: 90,
      voice: true,
      googleWorkspace: true,
      webSearch: true,
      imageGeneration: true,
      scheduledJobs: true,
      knowledgeBase: true,
      prioritySupport: true,
    },
  },
  business: {
    id: 'business',
    name: 'Business',
    priceMonthly: 99,
    stripePriceEnv: 'STRIPE_PRICE_BUSINESS',
    features: [
      'Everything in Pro',
      'Up to 5 channels',
      'Up to 5 AI agents',
      'Unlimited messages',
      '365-day history',
      'Priority email support',
    ],
    limits: {
      channels: 5,
      agents: 5,
      monthlyMessages: 1000000,
      historyDays: 365,
      voice: true,
      googleWorkspace: true,
      webSearch: true,
      imageGeneration: true,
      scheduledJobs: true,
      knowledgeBase: true,
      prioritySupport: true,
    },
  },
}

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) ?? 'free'] ?? PLANS.free
}
