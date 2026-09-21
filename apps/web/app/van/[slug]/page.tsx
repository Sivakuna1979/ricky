// @ts-nocheck
import { Suspense } from 'react'
import VanProfileClient from '@/components/van/VanProfileClient'

// J64 — SEO/share metadata for the public van page. Server component so
// generateMetadata can run; the actual interactive menu/cart/checkout
// experience is unchanged and lives in VanProfileClient (moved here
// verbatim from what used to be this file, plus Phase J additions —
// search, allergens, images, favourites, live status). Only public,
// already-public fields are used — no private address/contact data beyond
// what the van page already showed.
async function getBusinessForMetadata(slug: string) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const res = await fetch(`${url}/rest/v1/businesses?select=name,description,city,postcode,business_type&slug=eq.${encodeURIComponent(slug)}&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data[0] : null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const business = await getBusinessForMetadata(params.slug)
  if (!business) return { title: 'Van not found — FoodTaxi' }
  const title = `${business.name} — Order Online | FoodTaxi`
  const description = business.description?.slice(0, 155)
    || `Order from ${business.name}${business.city ? ` in ${business.city}` : ''} — track them live and order ahead on FoodTaxi.`
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
  }
}

export default function VanProfilePage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={null}>
      <VanProfileClient slug={params.slug} />
    </Suspense>
  )
}
