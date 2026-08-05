# YouTube Channel Automation

An automated (but human-supervised) YouTube content pipeline: topic research →
scripting → voice-over → rendering → thumbnails → metadata → copyright/policy
checks → upload/scheduling → analytics → optimisation. Built as a new
workspace (`apps/youtube`) in this monorepo, alongside `apps/web` (Food Taxi)
and `apps/agent` (AgentHub) — it shares the same Supabase project (new
`yt_`-prefixed tables) but is otherwise a fully independent product with its
own Vercel deployment.

**Default operating mode is Assisted Automation**: everything is generated
automatically, but nothing uploads until you approve the final video. Manual
and Full Automation modes are also available per channel — see
`app/dashboard/settings`.

## 1. System architecture

```
┌─────────────────────────┐        ┌──────────────────────────────────┐
│   Next.js app (Vercel)  │        │  Worker process (Railway/Render/  │
│                          │        │  Cloud Run — long-running Node)   │
│  • Dashboard UI          │        │                                    │
│  • Auth (Supabase)       │  BullMQ│  • worker/pipeline.ts             │
│  • OAuth connect flow    │  jobs  │    topic → research → script →    │
│  • Provider settings     │◄──────►│    voiceover → visuals → ffmpeg   │
│    (encrypted keys)      │ (Redis)│    render → subtitles → thumbnail │
│  • API routes: approve/  │        │    → metadata → policy/copyright  │
│    reject/regenerate/    │        │    checks → YouTube upload        │
│    edit/pause            │        │  • worker/ffmpeg.ts (shells out   │
│  • Cron routes: only     │        │    to the ffmpeg binary)          │
│    enqueue jobs — never  │        │  • worker/scheduler.ts (optional  │
│    run ffmpeg here       │        │    standalone cron alternative)   │
└───────────┬──────────────┘        └───────────────┬────────────────────┘
            │                                        │
            ▼                                        ▼
   ┌────────────────────────────────────────────────────────┐
   │                  Supabase (Postgres + Storage)           │
   │  yt_* tables (RLS-scoped to yt_channels.user_id)          │
   │  Storage buckets: media (renders/thumbnails/voiceovers),  │
   │  music-library (licensed background music + manifest)     │
   └────────────────────────────────────────────────────────┘
                            │
                            ▼
                 YouTube Data API v3 (OAuth 2.0)
        videos.insert · thumbnails.set · captions.insert
        playlistItems.insert · videos.list (stats/status)
```

Why two deployables: Vercel serverless functions cannot run multi-minute
ffmpeg renders or hold a persistent Redis/BullMQ connection, so **all**
rendering, uploading and long-running work happens in the standalone worker
process (`npm run worker`), deployed to a normal long-running host. The
Next.js app only ever does lightweight DB reads/writes and enqueues jobs.

## 2. Folder structure

```
apps/youtube/
  app/                        Next.js App Router
    dashboard/                 Authenticated UI (see below)
    api/
      youtube/oauth/{start,callback}   Google OAuth connect flow
      approvals/[id]/decide            Approve/reject/request-changes
      topics|scripts|videos/[id]/regenerate
      videos/[id]/metadata             Edit title/description/tags/chapters
      schedule/[id]                    Edit a calendar slot
      channels/[id]/{settings,pause}
      niches, niches/score              Niche-comparison tool
      providers, providers/[id]         Provider API key CRUD
      pause                             Emergency pause (global)
      run-now                           Manual "produce today" trigger
      cron/{enqueue-production-run,poll-uploads,sync-analytics}
    login, register, auth/callback
  components/                 Client components (approval buttons, forms…)
  lib/
    supabase/                 Server/browser/middleware Supabase clients
    providers/                Pluggable AI/TTS/image/stock/music providers
    youtube/                  OAuth + Data API client (googleapis)
    pipeline/                 Pure business logic (topics, research, script,
                               safety checks, cost tracking, scheduling,
                               notifications, subtitles, metadata, thumbnail
                               prompt-building, voiceover, visual planning)
    crypto.ts                 AES-256-GCM encryption for stored secrets
    credentials.ts            Encrypted provider-credential CRUD
    queue/                    BullMQ queue definitions + Redis connection
    types.ts                  Shared domain types/enums
  worker/
    index.ts                  Standalone worker entrypoint (BullMQ workers)
    pipeline.ts                Full pipeline orchestration + approval gating
    ffmpeg.ts                  The only file that shells out to ffmpeg
    scheduler.ts               Optional standalone cron alternative
    processors/                One processor per queue
supabase/migrations/
  20240040_youtube_platform_schema.sql
  20240041_youtube_platform_rls.sql
  20240042_youtube_platform_functions.sql
  20240043_youtube_storage_buckets.sql
```

## 3–7: Database schema, environment template, and setup instructions

See:

- `supabase/migrations/20240040_youtube_platform_schema.sql` — full schema
- `.env.local.example` — environment variable template
- `SETUP.md` — end-to-end local setup
- `GOOGLE_CLOUD_SETUP.md` — Google Cloud project + OAuth client + YouTube API
- `SUPABASE_SETUP.md` — migrations, storage buckets, auth
- `TESTING.md` — how to exercise each stage
- `DEPLOYMENT.md` — Vercel (web) + Railway/Render/Cloud Run (worker)
- `CHECKLIST.md` — what's implemented vs. what needs a paid key / manual step

## Approval modes & the emergency pause

Every pipeline run checks `yt_profiles.is_paused` (global) and
`yt_channels.is_paused` (per channel) before doing **any** further work —
see `checkPause()` in `worker/pipeline.ts`. The pause button in the dashboard
sidebar sets that flag immediately; an in-flight ffmpeg render finishes, but
nothing new starts and no upload goes out while paused.

Approval-mode gating (`yt_channel_settings.approval_mode`):

- **manual** — pauses after topic generation, again after script generation,
  and again after the full video/thumbnail is rendered. Each pause creates a
  row in `yt_approvals` and an email notification.
- **assisted** (default) — runs straight through generation and rendering,
  then pauses once, before upload, for a final review.
- **full_auto** — uploads automatically, but only if every blocking
  copyright/policy check passes and the combined quality score is ≥ 6.5/10;
  otherwise it falls back to requesting approval like assisted mode.

## Content quality & compliance, by design

- Every script is generated fresh per request; originality is checked with
  shingled-text similarity against every prior script on the channel *and*
  against the research source text itself (`lib/pipeline/script.ts`).
- Hooks are checked against the last 20–30 hooks used on the channel to avoid
  a repetitive opening line.
- Every factual claim is tied to a recorded source
  (`yt_research_sources`), and low-confidence/low-reliability/unsourced
  claims block a news-style video from proceeding.
- Every media asset (stock video/image, generated image, music) gets a
  `license_type`/`license_url` row before a video can pass its copyright
  check — nothing is scraped from other creators' videos or downloaded from
  TikTok/Instagram/Facebook/YouTube.
- Generated visuals are stock footage (Pexels License) or original
  AI-generated graphics/illustrations — never a photorealistic depiction of
  a real, named person.
- A synthetic-media disclosure line is added to every description (AI
  voice-over + AI-assisted visuals), and `containsSyntheticMedia` is set on
  the YouTube upload when the script implies real footage of a real event.
- Titles are checked against the script for misleading/clickbait claims, and
  thumbnails are AI-generated text-free backgrounds with the title burned in
  separately (no fabricated "shocking" claims baked into the image).
