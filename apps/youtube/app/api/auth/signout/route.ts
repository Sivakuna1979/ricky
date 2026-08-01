import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
  return NextResponse.redirect(new URL('/login', appUrl), { status: 303 })
}
