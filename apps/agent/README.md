# AgentHub — Multi-tenant WhatsApp / Telegram AI Agent Platform

A SaaS where each customer (workspace) gets their own AI agents connected to
WhatsApp and Telegram. Built with Next.js 14 (App Router), Supabase (auth +
Postgres + RLS), Anthropic Claude (tool-use agent loop) and Stripe (billing).

This is the product from the pricing card: WhatsApp + Telegram channels, AI
agents, voice conversations, Google Workspace, web search + image generation,
scheduled reminders & jobs, knowledge base, conversation history and billing.

## Architecture

```
Inbound message (Telegram / WhatsApp webhook)
  → app/api/webhooks/{telegram,whatsapp}/[secret]   per-channel webhook URL
  → lib/channels/*                                  normalize provider payload
  → lib/agent/process.ts                            contact + conversation, limits
  → lib/agent/engine.ts                             Claude tool-use loop
        ├─ tools/web.ts        web search + image generation
        ├─ tools/knowledge.ts  knowledge base (Postgres full-text search)
        ├─ tools/reminders.ts  scheduled jobs (cron + one-shot)
        └─ tools/google.ts     Gmail / Calendar / Sheets / Drive
  → lib/channels/* (sendText / sendImage)           deliver reply
```

Multi-tenancy: every row is scoped to a `workspace`. Row Level Security
(see `supabase/migrations/20240020_agent_platform.sql`) ensures users only
access their own workspace's data. Webhooks and cron use the service-role
client because they have no user session.

Plan limits live in `lib/plans.ts` and are enforced in `process.ts`
(monthly messages) and the channel/tool layers (channel count, feature gates).

## Setup

1. Apply the migration: `supabase db push` (from repo root).
2. Copy `.env.example` → `.env.local` and fill in Supabase, Anthropic, Stripe,
   Google and tool-provider keys.
3. `cd apps/agent && npm install && npm run dev` (runs on port 3001).

### Connecting a channel

- **Telegram**: create a bot with @BotFather, paste the token in the dashboard,
  click *Connect* — the app registers the webhook automatically.
- **WhatsApp**: create a Meta WhatsApp Cloud API app, paste the access token,
  phone number id and a verify token. Copy the shown webhook URL + verify token
  into Meta → WhatsApp → Configuration.

### Scheduled jobs

Point a scheduler (Vercel Cron / GitHub Action) at
`POST /api/cron/run-jobs` every minute with header
`Authorization: Bearer $CRON_SECRET`.

## Provider-neutral tools

Web search, image generation and voice (STT/TTS) call configurable endpoints
(see `.env.example`) so you can swap vendors without code changes. The agent's
reasoning is always Claude.
