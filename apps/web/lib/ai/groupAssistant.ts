// @ts-nocheck
// M65-M70 — FoodTaxi Group AI. A genuinely SEPARATE tool-use loop from
// lib/ai/assistant.ts (business AI) — a deliberate duplication of the
// small model-call helper rather than sharing code with Phase E's
// assistant, so there is zero risk of the business tool registry and the
// group tool registry ever being merged or confused by a future edit.
//
// Deliberately READ-ONLY and STATELESS in this pass: no group-level
// propose_*/write tool exists (M68's safe-action requirement is trivially
// met by having nothing to confirm), and no conversation is persisted —
// `ai_conversations.business_id` is NOT NULL (Phase E's schema), and
// widening that core table's constraint for a stateless group feature
// was judged out of scope/unnecessary risk for this pass. Each request is
// a single turn; the caller may resend prior turns as `history` from its
// own client-side state if it wants a threaded feel, but nothing is
// stored server-side.
import Anthropic from '@anthropic-ai/sdk'
import { groupToolDefinitions, GROUP_TOOLS_BY_NAME } from './tools/group'
import type { GroupContext } from '@/lib/groups/context'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const PRIMARY_MODEL = process.env.ANTHROPIC_FOODTAXI_MODEL ?? 'claude-fable-5'
const FALLBACK_MODEL = process.env.ANTHROPIC_FOODTAXI_FALLBACK_MODEL ?? 'claude-opus-4-8'
const MAX_TOOL_ROUNDS = 5
const MAX_TOKENS = 1200

function systemPrompt(ctx: GroupContext) {
  return `You are FoodTaxi Group AI, an operations assistant for the group/franchise "${ctx.groupName}". You are speaking with someone whose group role is ${ctx.role}${ctx.regionId ? ' (scoped to one region)' : ''}.

RULES:
1. You have no database access beyond the tools provided — every tool is already scoped server-side to exactly the businesses this person is authorised to see within this one group. You cannot see any other group, and you cannot see any business's detailed finance, customer contact details, staff personal data, payment/accounting credentials, or private documents — those are simply not available to any tool you have.
2. Never state a figure unless a tool result gave it to you this turn.
3. Comparisons between businesses are always factual measurements (revenue, orders, counts) — never an opaque score, grade, or ranking, and never framed as praise or blame for a business or its staff.
4. You cannot connect/disconnect anything, invite or remove a business or group member, change a role, apply a menu template, send an announcement, move stock between businesses, or write anything at all — those all require a person to act directly in the app. If asked, say so and explain it needs to be done through the normal group screens.
5. Keep answers concise and practical.`
}

async function callModel(system: string, messages: any[], tools: any[]) {
  try {
    return await client.beta.messages.create({
      model: PRIMARY_MODEL, max_tokens: MAX_TOKENS, system, messages, tools,
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: FALLBACK_MODEL }],
    })
  } catch {
    return await client.messages.create({ model: FALLBACK_MODEL, max_tokens: MAX_TOKENS, system, messages, tools })
  }
}

export async function runGroupAssistant(admin: any, ctx: GroupContext, history: { role: 'user' | 'assistant'; content: string }[]) {
  const tools = groupToolDefinitions()
  const system = systemPrompt(ctx)
  let messages: any[] = history.map(m => ({ role: m.role, content: m.content }))
  const toolCallLog: any[] = []

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response
    try {
      response = await callModel(system, messages, tools)
    } catch (e: any) {
      return { text: 'FoodTaxi Group AI is temporarily unavailable — please try again in a moment.', toolCalls: toolCallLog }
    }

    const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use')
    if (!toolUseBlocks.length) {
      const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      return { text: text || "I don't have an answer for that.", toolCalls: toolCallLog }
    }

    messages.push({ role: 'assistant', content: response.content })
    const toolResults = []
    for (const block of toolUseBlocks) {
      const tool = GROUP_TOOLS_BY_NAME[block.name]
      let resultContent: any
      try {
        resultContent = tool ? await tool.handler(admin, ctx, block.input ?? {}) : { error: 'unknown_tool' }
      } catch (e: any) {
        resultContent = { error: 'tool_failed' }
      }
      toolCallLog.push({ tool: block.name, args: block.input })
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(resultContent) })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  return { text: 'I need more steps than I’m allowed to answer that fully — try narrowing the question.', toolCalls: toolCallLog }
}
