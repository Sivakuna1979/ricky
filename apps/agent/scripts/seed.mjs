#!/usr/bin/env node
// Seed demo data so the dashboard looks alive right after setup.
// Inserts a knowledge doc, a demo contact + conversation with messages, and a
// few usage events into your first workspace (or WORKSPACE_ID if set).
//
//   npm run seed
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const file of ['.env', '.env.local']) {
  const path = join(root, file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY || URL.includes('your-')) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.')
  process.exit(1)
}

const base = `${URL.replace(/\/$/, '')}/rest/v1`
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function rest(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  // Find workspace.
  let workspaceId = process.env.WORKSPACE_ID
  if (!workspaceId) {
    const ws = await rest('GET', '/workspaces?select=id,name&order=created_at.asc&limit=1')
    if (!ws.length) {
      console.error('No workspaces found. Sign up in the app first, then re-run seed.')
      process.exit(1)
    }
    workspaceId = ws[0].id
    console.log(`Seeding workspace: ${ws[0].name} (${workspaceId})`)
  }

  // Agent (reuse first, else create one).
  let agents = await rest('GET', `/agents?select=id&workspace_id=eq.${workspaceId}&limit=1`)
  let agentId = agents[0]?.id
  if (!agentId) {
    const a = await rest('POST', '/agents', {
      workspace_id: workspaceId,
      name: 'Demo Agent',
      system_prompt: 'You are a friendly support agent for a demo store.',
    })
    agentId = a[0].id
  }

  // Knowledge docs.
  await rest('POST', '/knowledge_documents', [
    {
      workspace_id: workspaceId,
      agent_id: agentId,
      title: 'Business hours',
      content: 'We are open Monday to Saturday, 9am to 8pm. Closed on Sundays and public holidays.',
      source: 'manual',
    },
    {
      workspace_id: workspaceId,
      agent_id: agentId,
      title: 'Returns policy',
      content: 'Items can be returned within 30 days with a receipt for a full refund.',
      source: 'manual',
    },
  ])

  // A channel to attach the demo conversation to (find or create a placeholder).
  let channels = await rest('GET', `/channels?select=id&workspace_id=eq.${workspaceId}&limit=1`)
  let channelId = channels[0]?.id
  if (!channelId) {
    const ch = await rest('POST', '/channels', {
      workspace_id: workspaceId,
      agent_id: agentId,
      type: 'telegram',
      name: 'Demo channel',
      status: 'disconnected',
      credentials: {},
    })
    channelId = ch[0].id
  }

  // Demo contact + conversation + messages.
  const contact = await rest('POST', '/contacts', {
    workspace_id: workspaceId,
    channel_id: channelId,
    external_id: `demo-${Date.now()}`,
    name: 'Demo Customer',
  })
  const convo = await rest('POST', '/conversations', {
    workspace_id: workspaceId,
    channel_id: channelId,
    agent_id: agentId,
    contact_id: contact[0].id,
  })
  await rest('POST', '/messages', [
    { conversation_id: convo[0].id, workspace_id: workspaceId, role: 'user', content: 'What are your opening hours?' },
    {
      conversation_id: convo[0].id,
      workspace_id: workspaceId,
      role: 'assistant',
      content: 'We’re open Monday–Saturday, 9am–8pm, and closed on Sundays. Anything else I can help with?',
      tokens: 42,
    },
  ])

  // Usage events spread over the last week so analytics shows a chart.
  const events = []
  for (let i = 0; i < 14; i++) {
    const d = new Date()
    d.setDate(d.getDate() - Math.floor(Math.random() * 7))
    events.push({ workspace_id: workspaceId, kind: 'message', created_at: d.toISOString() })
  }
  await rest('POST', '/usage_events', events)

  console.log('✓ Demo data seeded. Open the dashboard to see agents, a conversation and analytics.')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
