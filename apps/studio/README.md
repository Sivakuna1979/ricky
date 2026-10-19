# Studio: AI photo and video editor

A browser-based photo and video editor with a Claude assistant. You type what you want, for example
"warm cinematic look, vertical for TikTok, keep 0:05–0:20, title 'Day one'". Claude looks at the photo
or the current video frame and sets the edits. Every edit stays editable by hand, and undo/redo works.

It lives in `apps/studio` and is fully independent of the other apps in this repo.

## What it does today

| | Photo | Video |
|---|---|---|
| One-tap looks (Vivid, Golden, Mono, Vintage, Cinematic…) | ✅ | ✅ |
| Brightness, contrast, saturation, warmth, hue, blur, vignette | ✅ | ✅ |
| Crop for platforms (1:1, 4:5, 9:16, 16:9, 4:3), rotate, flip | ✅ | ✅ |
| Text / captions (position, size, colour) | ✅ | ✅ |
| Trim, speed (0.25–4×), volume / mute | | ✅ |
| AI assistant + "Auto enhance" (Claude with vision) | ✅ | ✅ |
| Undo / redo, before/after compare | ✅ | ✅ (undo) |
| Export | JPG / PNG, full resolution | MP4 (H.264/AAC), up to 1080p |

### Why it's cheap to run (this matters if you sell it)

All rendering happens **on the user's device**. Photos are rendered with Canvas, and videos are
encoded with ffmpeg compiled to WebAssembly, which is self-hosted from `/public/ffmpeg`. Your server
never receives the full-size files, so storage and video-processing costs are zero.
The only paid call is the AI request, which sends a small (≤768 px) JPEG preview plus the current
settings to Claude. The app also limits each IP address to 12 AI requests per minute and 200 per day
by default (`STUDIO_AI_DAILY_LIMIT`).

## Run it

```bash
cd apps/studio
npm install            # also copies the ffmpeg.wasm core into public/ffmpeg
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev            # http://localhost:3003
```

You need an Anthropic API key from https://console.anthropic.com. Without one, everything except
the AI assistant still works.

```bash
npm test               # unit tests + runs the generated video command through real ffmpeg (if installed)
npm run type-check
npm run build
```

### Deploy (Vercel)

Create a new Vercel project with **Root Directory = `apps/studio`** and add `ANTHROPIC_API_KEY`
(and optionally `STUDIO_AI_DAILY_LIMIT`) as environment variables. `vercel.json` is already included.

## How it's built

```
app/page.tsx            landing page
app/photo/page.tsx      photo editor
app/video/page.tsx      video editor (canvas preview + trim timeline)
app/api/ai/route.ts     Claude endpoint → structured JSON "patch" of edit settings
lib/edits.ts            the shared edit model, presets, validation/clamping of AI output
lib/render.ts           canvas renderer (used for photo preview, photo export, video preview)
lib/ffmpeg-args.ts      turns the edit model into an ffmpeg command (same look as the preview)
lib/video-export.ts     runs ffmpeg.wasm in the browser
```

The AI never edits pixels directly. It returns a structured patch, such as `{ adjust: { warmth: 35 }, aspect: "9:16" }`.
The app validates and clamps that patch, then applies it, so the AI can't break the editor and users can tweak whatever it chose.

## Honest limits (and what to add next)

Claude understands images and instructions, but it **does not generate or repaint pixels**. The features
below need extra models or services. They're listed roughly in order of value for a paid product:

1. **Accounts + billing.** Add Supabase auth and Stripe subscriptions. The `apps/research` app in this repo
   already has both patterns to copy. Charge for AI requests and keep manual editing free.
2. **Auto captions / subtitles for video.** Add a speech-to-text API (for example Whisper or Deepgram),
   then let Claude clean up and style the captions.
3. **Background removal.** Run a segmentation model in the browser or call a hosted API. Check the licence
   before you sell it, because some popular libraries are AGPL.
4. **Multi-clip timeline.** Join several clips, add transitions and background music (licensed tracks only).
5. **Generative fill / object removal.** This needs an image-generation model, so it's a paid API per use.
6. **Shared rate limiting.** The current limiter runs in memory on each server instance. Move it to
   Redis/Upstash before launch.

Before you sell to the public, also add terms of service and a privacy policy. The privacy policy must
mention that previews go to Anthropic when the AI is used.
