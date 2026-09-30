import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/auth/server'

export async function POST(req: Request) {
  await supabaseServer()?.auth.signOut()
  return NextResponse.redirect(new URL('/', req.url), { status: 303 })
}
