# Google Cloud & YouTube Data API setup

This is a manual, one-time setup you do in the Google Cloud Console — there
is no way to automate creating an OAuth client or requesting API access.

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com/ and create a new project (or
   reuse an existing one) — e.g. "YouTube Automation".

## 2. Enable the YouTube Data API v3

1. In the project, go to **APIs & Services → Library**.
2. Search for **YouTube Data API v3** and click **Enable**.
3. (Optional, for deeper analytics later) also enable **YouTube Analytics API**.

## 3. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** (unless you have a Google Workspace org — then
   Internal is fine and skips verification).
3. Fill in app name ("YouTube Channel Automation"), support email, and your
   own email as developer contact.
4. **Scopes**: add
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.force-ssl`
   - `https://www.googleapis.com/auth/yt-analytics.readonly`
5. **Test users**: while the app is "Testing" (unverified), add the Google
   account(s) that own the YouTube channel(s) you'll connect. Google caps
   unverified apps' refresh tokens' usability for sensitive scopes to test
   users only — for production use with channels outside your own Google
   Workspace, you'll eventually need to submit the app for **verification**
   (Google reviews the youtube.upload scope specifically; expect this to
   take some days and to require a demo video of the OAuth flow).

## 4. Create an OAuth 2.0 Client ID

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URIs — add both:
   - `http://localhost:3002/api/youtube/oauth/callback` (local dev)
   - `https://YOUR-PRODUCTION-DOMAIN/api/youtube/oauth/callback`
4. Save. Copy the **Client ID** and **Client secret** into
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in your `.env.local` (and in
   your Vercel project's environment variables).

## 5. Quota

The YouTube Data API's default daily quota is 10,000 units. A single
`videos.insert` (upload) costs **1,600 units** — so the default quota
supports roughly 6 uploads/day across all connected channels sharing the
project's quota. Two videos/day for one channel comfortably fits; if you
connect several channels to the same Google Cloud project, request a quota
increase via **APIs & Services → Quotas** (this requires a written
justification and Google's approval, and is not instant).

## 6. What this app does with the access it's granted

- It never sees or stores your Google account password — only the OAuth
  access/refresh tokens Google issues after you approve the consent screen,
  and those are encrypted (AES-256-GCM) before being written to the
  database (`apps/youtube/lib/youtube/oauth.ts`).
- It uploads videos as **private**, schedules them to go public at the time
  you configured, sets a custom thumbnail, uploads an English caption track,
  and adds the video to an auto-created "Shorts" or "Full Videos" playlist.
- It reads back video statistics (views/likes/comments) via
  `videos.list` for the dashboard's Analytics page.

You can revoke access at any time from
https://myaccount.google.com/permissions — the channel will show as
"error"/disconnected in the dashboard and automation for it will stop until
reconnected.
