import { createAdminClient } from '@/lib/supabase/server'
import { getPlan } from '@/lib/plans'
import type { Channel, InboundMessage, Workspace, Agent } from '@/lib/types'
import { sendText, sendImage } from '@/lib/channels'
import { downloadWhatsappMedia } from '@/lib/channels/whatsapp'
import { runAgentTurn } from './engine'
import { transcribeAudio } from './voice'

// Full inbound pipeline: identify contact + conversation, enforce plan limits,
// run the agent, persist the exchange and deliver the reply. Uses the service
// role client because webhooks have no authenticated user session.
export async function processInbound(channel: Channel, inbound: InboundMessage): Promise<void> {
  const supabase = createAdminClient()

  // --- Load workspace + agent ---
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', channel.workspace_id)
    .single<Workspace>()
  if (!workspace) return

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', channel.agent_id ?? '')
    .maybeSingle<Agent>()
  if (!agent) return

  const plan = getPlan(workspace.plan)

  // --- Enforce monthly message limit ---
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .eq('kind', 'message')
    .gte('created_at', monthStart.toISOString())

  if ((count ?? 0) >= plan.limits.monthlyMessages) {
    await sendText(
      channel,
      inbound.fromExternalId,
      'This assistant has reached its monthly message limit. Please try again later.'
    )
    return
  }

  // --- Resolve contact ---
  const { data: contact } = await supabase
    .from('contacts')
    .upsert(
      {
        workspace_id: workspace.id,
        channel_id: channel.id,
        external_id: inbound.fromExternalId,
        name: inbound.fromName ?? null,
        phone: channel.type === 'whatsapp' ? inbound.fromExternalId : null,
      },
      { onConflict: 'channel_id,external_id' }
    )
    .select()
    .single()
  if (!contact) return

  // --- Resolve open conversation ---
  let { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('channel_id', channel.id)
    .eq('contact_id', contact.id)
    .eq('status', 'open')
    .maybeSingle()

  if (!conversation) {
    const { data: created } = await supabase
      .from('conversations')
      .insert({
        workspace_id: workspace.id,
        channel_id: channel.id,
        agent_id: agent.id,
        contact_id: contact.id,
      })
      .select()
      .single()
    conversation = created
  }
  if (!conversation) return

  // --- Determine user text (transcribe voice if needed) ---
  let userText = inbound.text ?? ''
  let mediaType = inbound.mediaType ?? null

  if (inbound.mediaType === 'audio' && inbound.mediaUrl) {
    if (!plan.limits.voice || !agent.voice_enabled) {
      await sendText(channel, inbound.fromExternalId, 'Voice messages are not enabled on this plan.')
      return
    }
    const fetcher = async (url: string) => {
      if (channel.type === 'whatsapp') return downloadWhatsappMedia(channel, url)
      const res = await fetch(url)
      return res.arrayBuffer()
    }
    const transcript = await transcribeAudio(inbound.mediaUrl, fetcher)
    userText = transcript ?? ''
    if (!userText) {
      await sendText(channel, inbound.fromExternalId, "Sorry, I couldn't understand that voice note.")
      return
    }
  }

  if (!userText && inbound.mediaType === 'image') {
    userText = '[The user sent an image]'
  }
  if (!userText) return

  // --- Persist inbound message ---
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    workspace_id: workspace.id,
    role: 'user',
    content: userText,
    media_url: inbound.mediaUrl ?? null,
    media_type: mediaType,
  })

  // --- Load recent history (respect plan retention window) ---
  const { data: historyRows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversation.id)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(20)

  const history = (historyRows ?? [])
    .reverse()
    .slice(0, -1) // drop the message we just inserted; engine adds it as userText
    .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // --- Run the agent ---
  const result = await runAgentTurn({
    workspace,
    agent,
    channel,
    conversationId: conversation.id,
    recipient: inbound.fromExternalId,
    history,
    userText,
  })

  // --- Persist + deliver reply ---
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    workspace_id: workspace.id,
    role: 'assistant',
    content: result.text,
    media_url: result.imageUrl ?? null,
    media_type: result.imageUrl ? 'image' : null,
    tokens: result.tokens,
  })

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id)

  await supabase.from('usage_events').insert({ workspace_id: workspace.id, kind: 'message' })

  if (result.imageUrl) {
    await sendImage(channel, inbound.fromExternalId, result.imageUrl, result.text)
  } else {
    await sendText(channel, inbound.fromExternalId, result.text)
  }
}
