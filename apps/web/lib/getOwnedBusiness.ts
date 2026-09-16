// @ts-nocheck
// Resolves the business owned by the signed-in user, the same way every
// business dashboard API route does it — tries the direct owner_id link
// first, then falls back to the get_my_business RPC (covers accounts set
// up before that column existed).
export async function getOwnedBusiness(supabase: any, userId: string) {
  const { data: userRow } = await supabase.from('users').select('id').eq('auth_id', userId).maybeSingle()
  if (userRow?.id) {
    const { data: biz } = await supabase.from('businesses').select('id, name').eq('owner_id', userRow.id).maybeSingle()
    if (biz) return biz
  }
  const { data: biz } = await supabase.rpc('get_my_business')
  return biz ?? null
}
