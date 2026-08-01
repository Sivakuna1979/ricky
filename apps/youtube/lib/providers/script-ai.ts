import type { ChatMessage, CostEstimate, ScriptAIProvider } from './types'
import type { ProviderSecret } from '@/lib/credentials'

// Works with any OpenAI-compatible chat-completions endpoint: OpenAI itself,
// Azure OpenAI, OpenRouter, together.ai, a local vLLM/Ollama gateway, etc.
// Select the vendor by setting `baseUrl` on the credential — defaults to
// api.openai.com. Requires the user's own paid API key (Provider Settings).
export class OpenAICompatibleScriptAIProvider implements ScriptAIProvider {
  name = 'openai-compatible'
  private baseUrl: string
  private apiKey: string
  private model: string

  constructor(secret: ProviderSecret) {
    this.apiKey = secret.apiKey
    this.baseUrl = secret.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'
    this.model = secret.model || 'gpt-4.1-mini'
  }

  async complete(
    messages: ChatMessage[],
    opts: { temperature?: number; maxTokens?: number; json?: boolean } = {}
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Script AI provider (${this.model}) request failed: ${res.status} ${body}`)
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error('Script AI provider returned an unexpected response shape.')
    }
    return content
  }

  estimateCost(inputChars: number, outputChars: number): CostEstimate {
    // Rough $/1K-token approximation (~4 chars/token) for a mid-tier model.
    // Actual cost is recorded from the vendor's own usage response where available.
    const inputTokens = inputChars / 4
    const outputTokens = outputChars / 4
    const costUsd = (inputTokens / 1000) * 0.0004 + (outputTokens / 1000) * 0.0016
    return { estimatedCostUsd: Number(costUsd.toFixed(4)), unit: 'per-request' }
  }
}
