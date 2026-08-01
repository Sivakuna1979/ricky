# Setup — YouTube Channel Automation

## Prerequisites

- Node.js 20.x
- A Supabase project (see `SUPABASE_SETUP.md`)
- A Google Cloud OAuth client for the YouTube Data API (see `GOOGLE_CLOUD_SETUP.md`)
- A Redis instance (Railway/Upstash/Render — any managed Redis works) for BullMQ
- `ffmpeg` installed locally if you want to run the worker on your own machine
  (`brew install ffmpeg` / `apt-get install ffmpeg` — needs libx264, aac and
  libass/subtitles support, which standard distro builds include)
- At minimum one API key each for: a script-generation AI (OpenAI-compatible),
  a research provider (Serper.dev), a TTS provider (ElevenLabs or OpenAI),
  an image-generation provider (OpenAI Images), and a stock-media provider
  (Pexels — free). These are added from the dashboard, not as env vars.

## 1. Install

```bash
cd apps/youtube
npm install
cp .env.local.example .env.local
# fill in .env.local — see SUPABASE_SETUP.md and GOOGLE_CLOUD_SETUP.md
```

Generate the credentials-encryption key:

```bash
openssl rand -base64 32
# paste into CREDENTIALS_ENCRYPTION_KEY
```

## 2. Database

From the repo root:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

See `SUPABASE_SETUP.md` for the storage bucket + music-library manifest step.

## 3. Run the web app

```bash
npm run dev   # http://localhost:3002
```

Register an account, then:

1. **Provider settings** — add your AI/TTS/image/stock-media API keys.
2. **Channels** — click "Connect a YouTube channel" and complete Google's
   consent screen.
3. **Channel settings** — pick a niche (use the Niche tool first), an
   upload pattern, and confirm the approval mode (defaults to Assisted).

## 4. Run the worker (separately)

The worker needs `ffmpeg` on PATH and a real filesystem — it does not run on
Vercel. Locally:

```bash
npm run worker        # long-running BullMQ workers
# or, one-off:
npm run scheduler      # fills today's schedule slots and enqueues jobs once
```

In production this is a second deployment of the same repo (see
`DEPLOYMENT.md`) with `npm run worker` as the start command instead of
`npm run start`.

## 5. Trigger a production run

- Automatically: Vercel Cron hits `/api/cron/enqueue-production-run` twice a
  day (`vercel.json`), which fills today's `yt_schedules` slots per
  channel and enqueues a `produce-video` job for each.
- Manually: the "Run today's production now" button on the dashboard's
  Today page (calls `/api/run-now`), useful for testing.

Watch progress in **Job history**, respond to anything in **Approvals**, and
review rendered output in **Videos & thumbnails** before it uploads (unless
running Full Automation).

## 6. Common first-run issues

- **"No X provider is configured yet"** — add the missing key on the
  Provider Settings page; the pipeline stage names the exact provider type
  it needs (`ProviderNotConfiguredError`).
- **"No licensed background music found"** — upload tracks + `manifest.json`
  to the `music-library` bucket (SUPABASE_SETUP.md §3).
- **ffmpeg errors mentioning `subtitles` filter** — your ffmpeg build is
  missing `libass`; install a build with `--enable-libass` (Homebrew's
  default build includes it; some minimal Docker base images strip it).
- **YouTube upload fails with a quota error** — see GOOGLE_CLOUD_SETUP.md §5.
