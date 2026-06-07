import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
  if (userData?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('leads')
    .select('*, sales_agent_messages(id, message_type, sent_at)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { business_name, contact_name, email, phone, area, source, auto_send_email = false } = body

  // Check if business already on platform
  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .ilike('name', `%${business_name}%`)
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Business already on platform', already_registered: true })
  }

  const onboarding_token = crypto.randomUUID().replace(/-/g, '')
  const onboarding_url = `${process.env.NEXT_PUBLIC_APP_URL}/register/business?token=${onboarding_token}`

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      business_name,
      contact_name,
      email,
      phone,
      area,
      source: source ?? 'manual',
      onboarding_token,
      onboarding_url,
      status: 'new',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // AI-generated intro email
  if (auto_send_email && email) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Write a short, friendly, professional introduction email to ${contact_name ?? 'the business owner'} at ${business_name} in ${area}.

        The email is from VanTrack — a platform that helps mobile food businesses with live GPS tracking, online ordering, QR codes, food hygiene management and more.

        Keep it brief (3-4 short paragraphs). Don't be pushy. End with a link to start a free trial: ${onboarding_url}

        Subject line: Help {business_name} get found by more customers

        Return ONLY the email body (no subject line).`,
      }],
    })

    const emailBody = (message.content[0] as { text: string }).text

    // Send via Resend
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
      subject: `Help ${business_name} get found by more customers`,
      text: emailBody,
    })

    // Log message
    await supabase.from('sales_agent_messages').insert({
      lead_id: lead.id,
      message_type: 'intro_email',
      subject: `Help ${business_name} get found by more customers`,
      body: emailBody,
      sent_at: new Date().toISOString(),
      ai_generated: true,
    })

    await supabase.from('leads').update({ status: 'contacted' }).eq('id', lead.id)
  }

  return NextResponse.json(lead, { status: 201 })
}
