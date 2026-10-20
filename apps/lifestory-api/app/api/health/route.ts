import { ttsProvider } from '@/lib/tts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({
    ok: true,
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    supabase: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    voice: ttsProvider(),
    payments: process.env.LIFESTORY_FREE_RENDERS === 'true' ? 'free (testing)' : process.env.REVENUECAT_SECRET_KEY ? 'revenuecat' : 'not configured',
  })
}
