# AI cost & caching notes (Phase B)

Written after wiring `ai_usage_log` (see `/admin/ai-costs`) into all ten
Anthropic call sites. These are recommendations based on reading the call
sites' actual prompt shapes, not measurements from live traffic yet — once
the migration is applied and `/admin/ai-costs` has a few days of real data,
revisit this against actual feature/model cost breakdown rather than
guessing from code alone.

## Highest-leverage: prompt caching on the two tool-use assistants

`lib/ai/assistant.ts` and `lib/ai/groupAssistant.ts` send a large, mostly-
static system prompt (the numbered rules block, several thousand
characters) on **every** call — and a single user question can trigger up
to `MAX_TOOL_ROUNDS` (5) calls in one conversation, each resending that
same system prompt in full. Anthropic's prompt caching
(`cache_control: { type: 'ephemeral' }` on the system block) would mean
only the first call in a round-trip pays full input-token price for that
block; every later round in the same loop — and every other call from the
same business within the cache TTL — hits the cached rate instead
(`cacheRead` in `lib/ai/pricing.ts`, priced far below `input`). This is the
single biggest win available without changing any behavior: the tool-use
loop structure already makes repeated calls with an identical prefix.

## Second: the WhatsApp menu block

`lib/ai/whatsappOrderParser.ts` (customer ordering) and the WhatsApp
webhook's `askClaude` (`app/api/webhooks/whatsapp/route.ts`) both embed a
van's full menu as text in every prompt. A menu changes rarely compared to
how often a van receives orders — on a busy day the same menu text is sent
dozens of times. Same fix as above: cache the menu portion of the prompt
(it's already a clean, separable block at the top of
`buildWhatsAppOrderPrompt`).

## Third: model tier on vision-extraction routes

`app/api/menu/scan` and `app/api/finance/documents/extract` both use
`claude-opus-4-8` for structured extraction from an image — the same kind
of task `app/api/ai/parse-schedule` and `app/api/ai/brand-scan` already do
successfully on `claude-haiku-4-5-20251001`, which is markedly cheaper per
`lib/ai/pricing.ts`'s estimates. Worth an A/B: run a batch of real menu
photos and receipts through Haiku and compare extraction accuracy before
switching — if accuracy holds, this is a straightforward tier downgrade
with no prompt changes.

## A tracking gap, not a cost problem

`app/api/events/discover`'s web-search loop (`call()`) can run up to 4
turns internally on `pause_turn` before returning — `ai_usage_log` only
records the *final* turn's token usage, not the sum across the loop (see
the comment at that call site). This under-counts that one feature's
logged cost; it's flagged here rather than fixed in Phase B, since summing
usage across a `pause_turn` loop is a small, separate change better done
with its own test coverage than folded into this phase's wiring pass.

## What NOT to do

Lowering `max_tokens` on any of these routes does **not** reduce cost —
billing is by tokens actually generated, not the ceiling — so it's not a
lever here; it only affects truncation risk. Resist the temptation to
"optimize" `max_tokens` values expecting a cost change.
