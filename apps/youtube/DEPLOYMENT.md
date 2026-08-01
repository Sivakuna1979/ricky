# Deployment

Two separate deployments of this one codebase:

## 1. Web app → Vercel

1. New Vercel project → import this repo → **Root Directory**: `apps/youtube`.
   `apps/youtube/vercel.json` supplies the build command and the four cron
   schedules (production runs at 06:00 & 14:00 UTC, upload-status polling
   every 15 minutes, analytics sync hourly — adjust to your timezone/cadence).
2. Set all variables from `.env.local.example` in the Vercel project's
   Environment Variables (Production + Preview). In particular set
   `CRON_SECRET` — Vercel automatically sends it as
   `Authorization: Bearer $CRON_SECRET` on cron-triggered requests once the
   env var exists, which is what `lib/cron-auth.ts` checks.
3. Update `GOOGLE_CLOUD_SETUP.md`'s OAuth client with the production
   redirect URI (`https://your-domain/api/youtube/oauth/callback`).
4. Deploy. Do **not** point Vercel at `npm run worker` — serverless
   functions have execution-time limits far shorter than a video render and
   cannot hold the persistent Redis connection BullMQ workers need.

## 2. Worker → Railway / Render / Google Cloud Run

Any host that runs a long-lived Node process with a writable filesystem and
lets you install `ffmpeg` works. Railway example:

1. New Railway project → deploy from the same GitHub repo.
2. **Root directory**: `apps/youtube`. **Build command**: `npm install`.
   **Start command**: `npm run worker`.
3. Add an `apt` buildpack step (or use a custom Dockerfile) that installs
   `ffmpeg` — Railway's Nixpacks builder can add it via a `nixpacks.toml`:
   ```toml
   [phases.setup]
   nixPkgs = ["ffmpeg", "dejavu_fonts"]
   ```
4. Set the same environment variables as the web app (this process needs
   `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `GOOGLE_CLIENT_ID/SECRET`,
   `CREDENTIALS_ENCRYPTION_KEY`, `THUMBNAIL_FONT_PATH` if you're not using
   the DejaVu default path).
5. Deploy. Confirm in the logs: `YouTube automation worker started.`

Render/Cloud Run: same idea — a Dockerfile based on `node:20-bookworm` with
`apt-get install -y ffmpeg fonts-dejavu-core` covers both ffmpeg and the
default thumbnail font; `CMD ["npm", "run", "worker"]`.

### Optional: standalone scheduler instead of Vercel Cron

If you'd rather not rely on Vercel Cron, add a second scheduled job on the
worker host (Railway Cron Job / a `node-cron` wrapper / system crontab)
running `npm run scheduler` at your two chosen times a day. Both paths call
the same idempotent `ensureScheduleAndEnqueue()`, so you can safely use one,
the other, or both as a belt-and-braces setup.

## 3. Redis

Any managed Redis works (Railway Redis plugin, Upstash, Render Redis). Put
its connection string in `REDIS_URL` on **both** deployments — the web app
needs it to enqueue jobs, the worker needs it to consume them.

## 4. Rollout recommendation

Per the phased build this repo follows: start every new channel on
**Manual** approval mode, move to **Assisted** (the default) once you trust
the topic/script quality, and only enable **Full Automation** on a channel
after you've watched its copyright/policy checks correctly catch problems in
Manual/Assisted mode over a real run of videos.
