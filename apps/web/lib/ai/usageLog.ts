// Phase B — shared AI call-site instrumentation. Every Anthropic call in
// the app wraps its create() with this so /admin/ai-costs has one place
// to read spend/latency/error data from, instead of each feature inventing
// its own logging (or, more likely, none at all).
import { waitUntil } from '@vercel/functions'
import { createAdminClient } from '@/lib/supabase/server'
import { estimateCostUsd } from './pricing'

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export type LogAiUsageInput = {
  feature: string
  model: string
  usage?: Usage
  latencyMs: number
  businessId?: string | null
  success: boolean
  errorMessage?: string | null
}

// Fire-and-forget by design: a logging failure (DB hiccup, RLS mistake)
// must never surface as a failure of the AI feature it's observing.
export async function logAiUsage(input: LogAiUsageInput): Promise<void> {
  try {
    const admin = await createAdminClient()
    await admin.from('ai_usage_log').insert({
      feature: input.feature,
      model: input.model,
      input_tokens: input.usage?.input_tokens ?? 0,
      output_tokens: input.usage?.output_tokens ?? 0,
      cache_read_tokens: input.usage?.cache_read_input_tokens ?? 0,
      cache_creation_tokens: input.usage?.cache_creation_input_tokens ?? 0,
      estimated_cost_usd: estimateCostUsd(input.model, input.usage),
      latency_ms: input.latencyMs,
      business_id: input.businessId ?? null,
      success: input.success,
      error_message: input.errorMessage ?? null,
    })
  } catch {
    // See above — never throw out of here.
  }
}

// Wraps a single Anthropic create() call with timing + usage logging, so
// every call site is a one-line change instead of hand-duplicated
// try/catch/timing boilerplate. Uses waitUntil() so the log write reliably
// completes even after the response is sent (same pattern already used in
// app/api/webhooks/whatsapp and app/api/events/discover for background
// work) — logging must never add latency to the AI feature itself.
//
// requestedModel is only used for the failure-path log row, since a thrown
// call never reaches a response to read the actually-served model from.
export async function withAiUsageLog<T extends { model: string; usage?: Usage }>(
  opts: { feature: string; requestedModel: string; businessId?: string | null },
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await fn()
    waitUntil(logAiUsage({
      feature: opts.feature, model: result.model, usage: result.usage,
      latencyMs: Date.now() - startedAt, businessId: opts.businessId, success: true,
    }))
    return result
  } catch (err: any) {
    waitUntil(logAiUsage({
      feature: opts.feature, model: opts.requestedModel,
      latencyMs: Date.now() - startedAt, businessId: opts.businessId, success: false, errorMessage: err?.message,
    }))
    throw err
  }
}
