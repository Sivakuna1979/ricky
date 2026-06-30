import Anthropic from '@anthropic-ai/sdk'
import type { Agent, Channel, Workspace } from '@/lib/types'
import { getPlan } from '@/lib/plans'
import { webSearch, generateImage } from './tools/web'
import { searchKnowledgeBase } from './tools/knowledge'
import { scheduleReminder } from './tools/reminders'
import {
  sendGmail,
  createCalendarEvent,
  appendToSheet,
  listDriveFiles,
} from './tools/google'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

export interface AgentTurnContext {
  workspace: Workspace
  agent: Agent
  channel: Channel
  conversationId: string
  // The end user's id on the channel (used as reminder recipient).
  recipient: string
  // Prior turns, oldest first.
  history: { role: 'user' | 'assistant'; content: string }[]
  // The new user input (already transcribed if it was voice).
  userText: string
}

export interface AgentTurnResult {
  text: string
  // If the agent generated an image, the URL to deliver alongside the text.
  imageUrl?: string
  tokens: number
}

// Decide which Anthropic tools to expose, based on the agent config and plan.
function buildTools(agent: Agent, workspace: Workspace): Anthropic.Tool[] {
  const plan = getPlan(workspace.plan)
  const enabled = new Set(agent.tools_enabled ?? [])
  const tools: Anthropic.Tool[] = []

  if (enabled.has('web_search') && plan.limits.webSearch) {
    tools.push({
      name: 'web_search',
      description: 'Search the web for current information. Use for recent facts, news, prices.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The search query' } },
        required: ['query'],
      },
    })
  }

  if (enabled.has('image_generation') && plan.limits.imageGeneration) {
    tools.push({
      name: 'generate_image',
      description: 'Generate an image from a text description. Returns an image to send the user.',
      input_schema: {
        type: 'object',
        properties: { prompt: { type: 'string', description: 'Detailed image description' } },
        required: ['prompt'],
      },
    })
  }

  if (enabled.has('knowledge_base') && plan.limits.knowledgeBase) {
    tools.push({
      name: 'search_knowledge_base',
      description:
        "Search this business's private knowledge base (docs, FAQs, policies) for answers.",
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'What to look up' } },
        required: ['query'],
      },
    })
  }

  if (enabled.has('reminders') && plan.limits.scheduledJobs) {
    tools.push({
      name: 'schedule_reminder',
      description:
        'Schedule a reminder or recurring job to message this user at a future time. Provide either run_at (ISO datetime) or cron (5-field expression).',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          prompt: { type: 'string', description: 'What the reminder message should say/do' },
          run_at: { type: 'string', description: 'ISO 8601 datetime for a one-off reminder' },
          cron: { type: 'string', description: '5-field cron expression for recurring jobs' },
        },
        required: ['name', 'prompt'],
      },
    })
  }

  if (enabled.has('google_workspace') && plan.limits.googleWorkspace) {
    tools.push(
      {
        name: 'send_email',
        description: 'Send an email via the connected Gmail account.',
        input_schema: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['to', 'subject', 'body'],
        },
      },
      {
        name: 'create_calendar_event',
        description: 'Create an event in the connected Google Calendar.',
        input_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            start: { type: 'string', description: 'ISO 8601 start datetime' },
            end: { type: 'string', description: 'ISO 8601 end datetime' },
            description: { type: 'string' },
          },
          required: ['summary', 'start', 'end'],
        },
      },
      {
        name: 'append_to_sheet',
        description: 'Append a row to a Google Sheet.',
        input_schema: {
          type: 'object',
          properties: {
            spreadsheet_id: { type: 'string' },
            range: { type: 'string', description: "e.g. 'Sheet1!A:C'" },
            values: {
              type: 'array',
              items: { type: 'array', items: { type: 'string' } },
              description: 'Rows of cell values',
            },
          },
          required: ['spreadsheet_id', 'range', 'values'],
        },
      },
      {
        name: 'search_drive',
        description: 'Search files in the connected Google Drive by name.',
        input_schema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      }
    )
  }

  return tools
}

// Execute a single tool call and return the result string. Side outputs (like a
// generated image url) are written into `out`.
async function runTool(
  name: string,
  input: any,
  ctx: AgentTurnContext,
  out: { imageUrl?: string }
): Promise<string> {
  switch (name) {
    case 'web_search':
      return webSearch(input.query)
    case 'generate_image': {
      const url = await generateImage(input.prompt)
      if (url.startsWith('http') || url.startsWith('data:')) {
        out.imageUrl = url
        return 'Image generated and will be sent to the user.'
      }
      return url
    }
    case 'search_knowledge_base':
      return searchKnowledgeBase(ctx.workspace.id, ctx.agent.id, input.query)
    case 'schedule_reminder':
      return scheduleReminder({
        workspaceId: ctx.workspace.id,
        agentId: ctx.agent.id,
        channelId: ctx.channel.id,
        recipient: ctx.recipient,
        name: input.name,
        prompt: input.prompt,
        runAt: input.run_at,
        cron: input.cron,
      })
    case 'send_email':
      return sendGmail(ctx.workspace.id, input.to, input.subject, input.body)
    case 'create_calendar_event':
      return createCalendarEvent(
        ctx.workspace.id,
        input.summary,
        input.start,
        input.end,
        input.description
      )
    case 'append_to_sheet':
      return appendToSheet(ctx.workspace.id, input.spreadsheet_id, input.range, input.values)
    case 'search_drive':
      return listDriveFiles(ctx.workspace.id, input.query)
    default:
      return `Unknown tool: ${name}`
  }
}

// Run one agent turn: send history + new message to Claude, resolve any tool
// calls in a loop, and return the final assistant reply.
export async function runAgentTurn(ctx: AgentTurnContext): Promise<AgentTurnResult> {
  const tools = buildTools(ctx.agent, ctx.workspace)
  const out: { imageUrl?: string } = {}

  const systemPrompt = `${ctx.agent.system_prompt}

Current date/time: ${new Date().toISOString()}.
You are talking to a customer over ${ctx.channel.type}. Keep replies concise and chat-friendly.
When you use a tool, incorporate its result naturally into your reply.`

  const messages: Anthropic.MessageParam[] = [
    ...ctx.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: ctx.userText },
  ]

  let totalTokens = 0
  let finalText = ''

  // Tool-use loop (bounded to avoid runaway cost).
  for (let step = 0; step < 6; step++) {
    const response = await anthropic.messages.create({
      model: ctx.agent.model || 'claude-opus-4-8',
      max_tokens: 1024,
      temperature: Number(ctx.agent.temperature ?? 0.7),
      system: systemPrompt,
      tools: tools.length ? tools : undefined,
      messages,
    })

    totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

    // Collect text and tool-use blocks.
    const textBlocks = response.content.filter((b) => b.type === 'text') as Anthropic.TextBlock[]
    finalText = textBlocks.map((b) => b.text).join('\n').trim()

    const toolUses = response.content.filter(
      (b) => b.type === 'tool_use'
    ) as Anthropic.ToolUseBlock[]

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      break
    }

    // Append the assistant turn, then run tools and feed results back.
    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      const result = await runTool(tu.name, tu.input, ctx, out)
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  if (!finalText && out.imageUrl) finalText = 'Here you go!'
  return { text: finalText || "Sorry, I couldn't generate a reply.", imageUrl: out.imageUrl, tokens: totalTokens }
}
