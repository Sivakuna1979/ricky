// @ts-nocheck
// Phase J — the one place that resolves "who is the signed-in customer".
// Reuses the pre-existing (previously unused) `customers` table rather than
// inventing a second identity concept — see the migration header comment
// for why. `customers` rows are created lazily on first use.

export async function getAuthedUserProfile(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) return null
  return {
    authUserId: user.id,
    userId: profile.id,
    email: (profile.email || user.email || '').toLowerCase(),
    fullName: profile.full_name,
    role: profile.role,
  }
}

export async function getOrCreateCustomerRecord(admin, userId) {
  const { data: existing } = await admin.from('customers').select('*').eq('user_id', userId).maybeSingle()
  if (existing) return existing
  const { data: created, error } = await admin.from('customers').insert({ user_id: userId }).select().single()
  if (error) {
    // Concurrent first-visit race — another request just created it.
    const { data: retry } = await admin.from('customers').select('*').eq('user_id', userId).maybeSingle()
    if (retry) return retry
    throw error
  }
  return created
}

// The single helper API routes should call to resolve "the signed-in
// customer, creating their customers row if this is their first visit".
// Returns null for guests — callers must handle that (most account-hub
// routes should 401 in that case).
export async function requireCustomer(supabase, admin) {
  const profile = await getAuthedUserProfile(supabase)
  if (!profile) return null
  const customer = await getOrCreateCustomerRecord(admin, profile.userId)
  return { ...profile, customer }
}

// J8 — guest -> account continuity. Only ever matches on an EXACT
// (case-insensitive) match between the signed-in customer's own verified
// account email and an order's guest_email, and only orders that don't
// already belong to a customer. Never matches on name, phone (unverified),
// or fuzzy similarity — a wrong match here would show someone else's order
// history, which is a security bug, not a convenience feature.
export async function claimGuestOrdersByEmail(admin, customerId, verifiedEmail) {
  const email = (verifiedEmail || '').trim().toLowerCase()
  if (!email) return { claimed: 0 }
  const { data, error } = await admin
    .from('orders')
    .update({ customer_id: customerId })
    .is('customer_id', null)
    .not('guest_email', 'is', null)
    .ilike('guest_email', email)
    .select('id')
  if (error) throw error
  return { claimed: data?.length ?? 0 }
}
