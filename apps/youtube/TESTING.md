# Testing instructions

There's no fixture-based test suite included in this MVP (see CHECKLIST.md);
the pipeline is I/O-heavy (real HTTP calls to AI/TTS/image/YouTube APIs and a
real ffmpeg render), so the most useful "test" for now is exercising the
real flow end-to-end in Manual mode, where every stage pauses for your
review before continuing. Suggested order:

## 1. Type-check and lint

```bash
cd apps/youtube
npm run type-check
npm run lint
```

## 2. Smoke-test each provider independently

Before running the full pipeline, sanity-check each configured key works,
e.g. from a Node REPL or a scratch script:

```ts
import { getScriptAIProvider } from '@/lib/providers/factory'
const ai = await getScriptAIProvider(supabase, userId)
console.log(await ai.complete([{ role: 'user', content: 'Say hi in 5 words.' }]))
```

Repeat for `getResearchProvider`, `getTTSProvider`, `getImageGenProvider`,
`getStockMediaProvider`.

## 3. End-to-end dry run in Manual mode

1. Set a channel's approval mode to **Manual**.
2. Click **Run today's production now**.
3. Watch **Job history** — you should see a `produce-video` job complete
   (it stops itself after inserting a topic, since Manual mode pauses there).
4. Go to **Approvals**, approve the topic. A new job resumes and stops again
   after the script is written.
5. Approve the script. This is the expensive step — TTS, stock media
   search/download, ffmpeg render, thumbnail generation, and all
   copyright/policy checks run. Watch for errors in Job history.
6. Once the video appears in **Videos & thumbnails** with its policy/
   copyright checks all green, approve it in **Approvals** to trigger the
   actual YouTube upload (uploaded as **private** first — verify it in
   YouTube Studio before it goes public at its scheduled time).

## 4. Verify the compliance gates actually gate

Useful negative tests:

- Put an obviously prohibited phrase in a niche description (e.g. something
  from `PROHIBITED_KEYWORDS` in `lib/pipeline/safety.ts`) and confirm the
  video is blocked from Full Automation and shows a red policy-warning badge.
- Temporarily rename the `music-library` bucket's manifest and confirm the
  render fails with a clear "no licensed background music found" error
  rather than silently shipping unlicensed audio.
- Try approving the same approval twice — the second call should 409
  ("Already decided").

## 5. Worker resilience

- Kill the worker process mid-render (`Ctrl+C`) and restart it — BullMQ
  redelivers the in-flight job (it isn't marked complete until the
  processor returns), so the render step re-runs from scratch. Confirm no
  duplicate `yt_videos` rows are created for the same schedule slot.
- Confirm `/api/cron/enqueue-production-run` is idempotent: call it twice in
  a row and check only one `produce-video` job (`jobId: produce-<scheduleId>`)
  exists per slot in the BullMQ dashboard (or `redis-cli` / Bull Board if you
  wire one up).
