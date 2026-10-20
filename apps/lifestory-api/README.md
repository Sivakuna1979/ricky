# Life Story API and render worker

The server side of [Life Story](../lifestory-mobile/README.md), which has the full launch guide.

```
app/api/films/[id]/interview   POST  answer → next interview question (Claude)
app/api/films/[id]/script      POST  photos + interview → film script (Claude with vision)
                               PUT   save the family's edits
app/api/films/[id]/render      POST  check the in-app purchase, then queue the film
app/api/health                 GET   which services are configured
worker/index.ts                      long-running: claim queued film → produce → upload → notify
worker/produce.ts                    photos + script → narration → render → upload
lib/film/plan.ts                     timing: scenes, crossfades, when each narration starts
lib/film/render.ts                   ffmpeg: slow zoom per photo, title/end cards, captions, music ducking
lib/film/text.ts                     titles and captions drawn with Pango (every script, correct shaping)
lib/tts.ts                           ElevenLabs (or OpenAI) narration
supabase/migrations/                 tables, row-level security, storage bucket, queue function
```

Every request from the app carries the person's Supabase access token. Routes check it and only
touch that person's films. Photos and films sit in a private bucket and the app views them with
short-lived signed links.

## Run locally

```bash
npm install
cp .env.example .env.local         # fill in your keys
npm run dev                        # API on http://localhost:3004
npm run worker                     # render worker (needs ffmpeg on PATH)
npm test                           # timeline + full render pipeline with fake storage
```

Without a voice key the worker uses silent placeholder narration, so you can test the whole
pipeline for free.
