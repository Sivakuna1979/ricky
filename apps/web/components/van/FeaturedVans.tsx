// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { VanCard } from './VanCard'

export async function FeaturedVans() {
  const supabase = await createClient()

  const { data: vans } = await supabase
    .from('vans')
    .select('*, businesses!inner(name, food_hygiene_rating, status), reviews(rating)')
    .eq('is_active', true)
    .eq('businesses.status', 'approved')
    .limit(6)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {(vans ?? []).map(van => (
        <VanCard key={van.id} van={van as any} />
      ))}
    </div>
  )
}
