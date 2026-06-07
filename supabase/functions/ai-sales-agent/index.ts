import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

serve(async (req) => {
  const { action, lead_id } = await req.json()

  if (action === 'send_followup' && lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('*, sales_agent_messages(*)')
      .eq('id', lead_id)
      .single()

    if (!lead || !lead.email) {
      return new Response(JSON.stringify({ error: 'Lead not found or no email' }), { status: 404 })
    }

    const messageCount = lead.sales_agent_messages?.length ?? 0

    const prompt = messageCount === 0
      ? `Write a brief, friendly introduction email to ${lead.contact_name ?? 'the business owner'} at ${lead.business_name} in ${lead.area}.
         You are reaching out from Food Taxi, a platform for mobile food businesses.
         Mention live GPS tracking, online ordering, QR codes and food hygiene management.
         Keep it under 200 words. End with their onboarding link: ${lead.onboarding_url}`
      : `Write a polite follow-up email to ${lead.contact_name ?? 'the business owner'} at ${lead.business_name}.
         This is follow-up #${messageCount}. Keep it very brief (under 100 words).
         Reference that you reached out before about Food Taxi.
         Their onboarding link: ${lead.onboarding_url}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const emailBody = (message.content[0] as { text: string }).text
    const subject = messageCount === 0
      ? `Help ${lead.business_name} get found by more customers`
      : `Following up — Food Taxi for ${lead.business_name}`

    // Log message (email sending handled by the web API)
    await supabase.from('sales_agent_messages').insert({
      lead_id,
      message_type: messageCount === 0 ? 'intro_email' : 'followup_email',
      subject,
      body: emailBody,
      ai_generated: true,
    })

    await supabase.from('leads').update({
      status: 'contacted',
      updated_at: new Date().toISOString(),
    }).eq('id', lead_id)

    return new Response(JSON.stringify({ subject, body: emailBody }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 })
})
