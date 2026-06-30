# AgentHub — Setup Guide

Get the WhatsApp/Telegram AI agent platform running. **Minimum to boot:**
Supabase + Anthropic. Everything else unlocks one feature and can wait.

> TL;DR — `cd apps/agent && npm run setup`, fill in `.env.local`, run
> `supabase db push` from the repo root, then `npm run dev`. Check progress
> anytime with `npm run check`.

---

## Step 1 — Supabase (required)

1. Create a project at https://supabase.com/dashboard
2. **Project Settings → API** → copy into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Apply the schema (from the **repo root**):
   ```bash
   supabase link --project-ref <your-ref>   # first time only
   supabase db push
   ```
   This runs `supabase/migrations/20240020_agent_platform.sql` (all tables +
   row-level security + the new-user auto-provisioning trigger).

## Step 2 — Anthropic (required)

API key from https://console.anthropic.com/settings/keys → `ANTHROPIC_API_KEY`.

## Step 3 — Run it

```bash
cd apps/agent
npm install
npm run check     # verifies env + DB
npm run dev       # http://localhost:3001
```

Sign up → you automatically get a workspace and a first agent.

## Step 4 — Connect Telegram (easiest channel)

1. In Telegram, message **@BotFather** → `/newbot` → copy the token.
2. Dashboard → **Channels** → Add channel → Telegram → paste token → **Connect**.
   The app registers the webhook with Telegram automatically.
3. Message your bot — it replies via Claude.

> Local dev: Telegram needs a public HTTPS URL for the webhook. Use a tunnel
> (`ngrok http 3001`) and set `NEXT_PUBLIC_APP_URL` to the tunnel URL, or just
> connect Telegram after deploying to Vercel.

## Step 5 — Connect WhatsApp (Meta Cloud API)

1. https://developers.facebook.com → create an app → add **WhatsApp**.
2. Copy the **temporary/permanent access token**, **phone number ID**, and pick
   any string as your **verify token**.
3. Dashboard → Channels → Add channel → WhatsApp → paste all three.
4. In Meta → WhatsApp → Configuration → Webhook, paste the **webhook URL** shown
   in the dashboard and the same **verify token**, then subscribe to `messages`.

## Step 6 — Billing with Stripe (optional)

1. Keys from https://dashboard.stripe.com/apikeys → `STRIPE_SECRET_KEY`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Create 3 recurring **Products/Prices** and copy their price IDs →
   `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`.
3. Add a webhook endpoint pointing at `<APP_URL>/api/webhooks/stripe`
   (events: `checkout.session.completed`, `customer.subscription.*`) →
   `STRIPE_WEBHOOK_SECRET`.

## Step 7 — Google Workspace (optional)

1. https://console.cloud.google.com → enable Gmail, Calendar, Sheets, Drive APIs.
2. Create an **OAuth client (Web)**. Authorized redirect URI:
   `<APP_URL>/api/integrations/google/callback`.
3. Copy client id/secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. Dashboard → Settings → **Connect Google**.

## Step 8 — Web search / images / voice (optional)

- Web search: https://serper.dev key → `SERPER_API_KEY`
- Images: any OpenAI-compatible images endpoint → `IMAGE_API_KEY`
- Voice: any OpenAI-compatible transcription endpoint → `STT_API_KEY`

## Deploy to Vercel

See the **Deployment** section in `README.md`. In short: new Vercel project,
Root Directory `apps/agent`, add all env vars, set `NEXT_PUBLIC_APP_URL` to the
production URL. The cron in `vercel.json` runs scheduled jobs every minute.

---

### Troubleshooting

- `npm run check` tells you exactly what's missing or whether the DB migration
  hasn't run.
- "tables missing" → you skipped `supabase db push`.
- Telegram/WhatsApp not replying → confirm `NEXT_PUBLIC_APP_URL` is the public
  URL the provider can actually reach (not localhost).
