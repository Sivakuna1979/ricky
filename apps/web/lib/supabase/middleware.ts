// @ts-nocheck
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSuperAdmin } from '@/lib/isSuperAdmin'
import { getSubscriptionState, computeHasAccess } from '@/lib/subscriptionAccess'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key',
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() refreshes the session and sets new cookies if needed.
  // Do NOT use getSession() here — it does not trigger token refresh.
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Protect /admin/* — this is the actual, single security boundary for the
  // whole admin area (it runs before any /admin/* page renders); individual
  // page-level checks are a secondary safety net, not the primary gate.
  if (path.startsWith('/admin')) {
    if (!user || !(await isSuperAdmin(supabase, user))) {
      const url = request.nextUrl.clone()
      url.pathname = !user ? '/login' : '/dashboard'
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return redirectResponse
    }
  }

  // Protect authenticated areas — redirect unauthenticated visitors to /login
  const guarded = ['/dashboard', '/business', '/account']
  if (guarded.some(p => path.startsWith(p)) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // FoodTaxi Business subscription gate (Phase B5/B6) — the real, single
  // enforcement point for business-owner dashboard functionality, same
  // pattern as the /admin gate above. /dashboard/billing is always exempt
  // (never redirect loop away from the one page that lets someone fix an
  // expired subscription). Super admins are always exempt — this gate is
  // about paying businesses, never about locking out platform admins.
  // Customer-facing routes (/van/[slug], /order/*, /receipt/*, etc.) are
  // outside /dashboard entirely and are never affected by this check.
  if (user && path.startsWith('/dashboard') && !path.startsWith('/dashboard/billing')) {
    if (!(await isSuperAdmin(supabase, user))) {
      const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (userData?.id) {
        let businessId: string | null = null
        const { data: owned } = await supabase.from('businesses').select('id').eq('owner_id', userData.id).maybeSingle()
        if (owned?.id) {
          businessId = owned.id
        } else {
          // Phase C: a staff account has no owned business, but the
          // subscription still belongs to the business they work for — a
          // lapsed owner subscription must gate staff dashboard access too
          // (Phase C31: staff tools are covered by the same subscription).
          const { data: staffRow } = await supabase.from('staff').select('business_id').eq('user_id', userData.id).eq('is_active', true).limit(1).maybeSingle()
          businessId = staffRow?.business_id ?? null
        }
        if (businessId) {
          const sub = await getSubscriptionState(supabase, businessId)
          if (!computeHasAccess(sub)) {
            const url = request.nextUrl.clone()
            url.pathname = '/dashboard/billing'
            url.searchParams.set('expired', '1')
            const redirectResponse = NextResponse.redirect(url)
            supabaseResponse.cookies.getAll().forEach(cookie => {
              redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
            })
            return redirectResponse
          }
        }
        // No business row yet — let the page itself handle sending them to
        // /register/business, as every dashboard page already does today.
      }
    }
  }

  return supabaseResponse
}
