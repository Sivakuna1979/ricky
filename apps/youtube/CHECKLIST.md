# Implementation checklist

Legend: ✅ implemented with real logic (no stubs) · 🔑 implemented, but needs
your own paid API key / manual account setup to actually run · 🚧 partially
implemented / simplified for the MVP · ⬜ not built yet (documented as a
next step, not silently missing)

## Phase 1 — MVP (this build)

| Feature | Status | Notes |
|---|---|---|
| User login (Supabase Auth) | ✅ | Email/password; RLS-scoped from the first query |
| YouTube OAuth connection | ✅ 🔑 | Needs a Google Cloud OAuth client — GOOGLE_CLOUD_SETUP.md |
| Channel settings | ✅ | Niche, upload pattern, approval mode, production mode, slot times |
| Niche & content settings | ✅ | Niche comparison tool with 9 scored dimensions + sensitive-category gate |
| Topic generation | ✅ 🔑 | Needs a script-AI key; scoring + duplicate-topic detection are real (Jaccard + hash) |
| Script generation | ✅ 🔑 | Grounded in recorded research, hook-repetition + originality-shingle checks |
| Voice-over generation | ✅ 🔑 | ElevenLabs (word timings) or OpenAI TTS (estimated pacing) |
| Basic FFmpeg video creation | ✅ | Real ffmpeg filter graph: scale/crop, Ken Burns on stills, concat, subtitle burn-in, ducked music mix |
| Subtitle creation | ✅ | SRT built from TTS word timings (or estimated scene pacing), burned in via ffmpeg + uploaded as a caption track |
| Thumbnail creation | ✅ 🔑 | AI-generated text-free background + ffmpeg text/gradient overlay |
| Title/description generation | ✅ 🔑 | Includes tags, hashtags, chapters, pinned comment, AI-disclosure line, sources list |
| Video preview | ✅ | Signed-URL video/thumbnail preview in the dashboard |
| Manual approval | ✅ | Topic/script/video/thumbnail gates via `yt_approvals` + dashboard Approve/Reject/Request changes |
| YouTube upload and scheduling | ✅ 🔑 | `videos.insert` (resumable), `thumbnails.set`, `captions.insert`, playlist add, `publishAt` scheduling |
| Two-posts-per-day scheduler | ✅ | Idempotent `ensureScheduleAndEnqueue`, Vercel Cron ×2/day + manual "Run now" |
| Job history | ✅ | `yt_job_logs`, dashboard table with status/duration/error |
| Error logs | ✅ | Per-job error messages; upload failures also raise a notification |
| Emergency pause | ✅ | Global (`yt_profiles.is_paused`) + per-channel, checked before every stage |

## Phase 2

| Feature | Status | Notes |
|---|---|---|
| Better stock-media search | 🚧 | Pexels only; multi-provider fallback (e.g. Pixabay) not wired up |
| Multiple visual styles | 🚧 | Style is a free-text prompt modifier (`standard` vs `premium`); no curated style presets/library yet |
| Advanced analytics | 🚧 | `videos.list` stats (views/likes/comments) sync hourly; YouTube Analytics API (impressions, CTR, retention curve, traffic sources, Shorts swipe-away) is **not** wired up — needs its own report-request implementation |
| Automatic topic optimisation | ⬜ | Analytics currently only display; nothing yet feeds performance back into topic scoring weights |
| Cost reporting | ✅ | Per-stage cost recording + daily/monthly spend-limit enforcement, dashboard Costs page |
| Playlists | ✅ | Auto-creates "Shorts"/"Full Videos" playlists and adds every upload |
| Email notifications | ✅ 🔑 | Via Resend; needs `RESEND_API_KEY` + a verified sending domain. In-app notification rows are always written even without it |
| Assisted Automation mode | ✅ | Default mode; pauses once before upload |
| A/B thumbnail/title testing | ⬜ | Schema has a `variant` column on `yt_thumbnails` to build on, but no experiment/rotation logic yet |
| WhatsApp/push notifications | ⬜ | `yt_notifications.sent_via` is an array specifically so channels can be appended later; only `email` is implemented |

## Phase 3

| Feature | Status | Notes |
|---|---|---|
| Full Automation | ✅ (gated) | Implemented and gated behind the quality-score threshold + all blocking checks passing; **you** should only enable it per channel after watching Manual/Assisted runs succeed, per the phased rollout this app follows |

## Known simplifications / explicitly out of scope for the MVP

- **No automated test suite.** The pipeline is dominated by real network
  calls (AI/TTS/image/YouTube) and a real ffmpeg subprocess; TESTING.md
  describes an end-to-end Manual-mode dry run instead. Unit tests for the
  pure logic (`lib/pipeline/topics.ts`, `subtitles.ts`, `cost.ts`, etc. —
  no I/O) would be the natural first addition.
- **Impersonation and misleading-thumbnail checks are heuristic**, not a
  vision-model review of the actual rendered thumbnail image — they scan
  the script/prompt text for real-person names near action verbs. Treat any
  hit as "needs a human look", not an automatic pass/fail you can fully trust.
- **News-style videos** require research sources newer than a month and a
  passing `verifySourceQuality` gate; there's no live-broadcast/breaking-news
  integration.
- **Music licensing is a manual library**, not a live API — see
  SUPABASE_SETUP.md §3. There is no automated Epidemic Sound/Artlist/etc.
  integration because none of them offer a public licensing API suitable for
  unattended use.
- **Sensitive-niche detection is keyword-based**, not a nuanced policy
  classifier — it's deliberately conservative (over-flags rather than
  under-flags) and always requires an explicit human acknowledgement before
  a flagged niche can be used.
