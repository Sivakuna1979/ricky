# Supabase setup

This app shares the same Supabase project as `apps/web` and `apps/agent` in
this monorepo (one Postgres database, namespaced tables). If you'd rather
run it standalone, create a fresh Supabase project and apply only the
`20240040`–`20240043` migrations listed below (they have no dependency on
the Food Taxi / AgentHub schemas beyond the shared `set_updated_at()`
function, which you'd need to copy from `20240003_functions_triggers.sql`).

## 1. Apply migrations

From the repo root, with the Supabase CLI installed and linked to your project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

This applies (among the existing Food Taxi/AgentHub migrations):

- `20240040_youtube_platform_schema.sql` — all `yt_*` tables
- `20240041_youtube_platform_rls.sql` — Row Level Security policies
- `20240042_youtube_platform_functions.sql` — triggers + `yt_spend_for_user()`
- `20240043_youtube_storage_buckets.sql` — the `media` and `music-library`
  private Storage buckets

If you don't use the CLI, you can instead paste each file's contents into
the Supabase Dashboard's **SQL Editor** and run them in order.

## 2. Auth

Supabase Auth (email/password) is used as-is — no extra configuration
needed beyond what the project already has. Every new `auth.users` row
automatically gets a matching `yt_profiles` row via the
`yt_handle_new_user()` trigger.

If you want Google or magic-link sign-in for the dashboard itself (separate
from the per-channel YouTube OAuth connection), enable it under
**Authentication → Providers** — no code changes required, `lib/supabase/*`
already uses `@supabase/ssr` generically.

## 3. Storage — background music library

The pipeline never downloads music from the open web. Instead:

1. In the Supabase Dashboard, open **Storage → music-library**.
2. Upload your licensed tracks (royalty-free, Creative Commons, or YouTube
   Audio Library exports — check each track's specific licence terms).
3. Upload a `manifest.json` at the bucket root describing each track:

```json
[
  {
    "id": "upbeat-corporate-1",
    "title": "Upbeat Corporate",
    "url": "https://YOUR_PROJECT.supabase.co/storage/v1/object/sign/music-library/upbeat-corporate-1.mp3?...",
    "durationSeconds": 180,
    "mood": ["upbeat", "corporate", "neutral"],
    "licenseType": "YouTube Audio Library — no attribution required",
    "attributionRequired": false
  }
]
```

`url` must be a URL the worker can fetch directly (a long-lived signed URL,
or make individual audio files public — the manifest itself stays in the
private bucket either way). See `lib/providers/music.ts` for exactly how
this is read.

## 4. Service role key

`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security and is required by
the worker (it has no user session) and by the app's cron/admin routes. Get
it from **Project Settings → API → service_role key**. Never expose it to
the browser — it's only read in `lib/supabase/server.ts`'s
`createAdminClient()`, which is server-only code.

## 5. Row Level Security model

Every `yt_*` table traces ownership back to `yt_channels.user_id = auth.uid()`,
directly or via a parent foreign key (see `20240041_youtube_platform_rls.sql`
for the exact policies). This means:

- Dashboard pages using the normal (cookie-authenticated) Supabase client
  only ever see the current user's own channels, topics, scripts, videos,
  costs, etc. — no manual `WHERE user_id = ...` filtering needed.
- The worker uses `createAdminClient()` (service role) since it runs with no
  user session — it deliberately bypasses RLS, which is expected for
  trusted server-side background processing.
