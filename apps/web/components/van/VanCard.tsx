import Link from 'next/link'
import Image from 'next/image'
import type { Van } from '@/types/database'
import { VanTypeBadge } from './VanTypeBadge'
import { TrackingBadge } from './TrackingBadge'

interface VanCardProps {
  van: Van & {
    businesses?: { name: string; food_hygiene_rating?: number | null }
    reviews?: { rating: number }[]
  }
}

export function VanCard({ van }: VanCardProps) {
  const avgRating = van.reviews?.length
    ? (van.reviews.reduce((s, r) => s + r.rating, 0) / van.reviews.length).toFixed(1)
    : null

  return (
    <Link href={`/van/${van.slug}`} className="group block">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        {/* Image */}
        <div className="relative h-48 bg-gray-100">
          {van.profile_image_url ? (
            <Image src={van.profile_image_url} alt={van.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">
              {vanTypeEmoji(van.van_type)}
            </div>
          )}
          <div className="absolute top-3 left-3">
            <TrackingBadge status={van.tracking_status} />
          </div>
          {van.businesses?.food_hygiene_rating != null && (
            <div className="absolute top-3 right-3 bg-white rounded-lg px-2 py-1 text-xs font-bold text-green-700">
              ⭐ {van.businesses.food_hygiene_rating}/5 Hygiene
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-brand-500 transition-colors">{van.name}</h3>
              {van.businesses?.name && (
                <p className="text-sm text-gray-500">{van.businesses.name}</p>
              )}
            </div>
            {avgRating && (
              <span className="text-sm font-medium text-gray-700">⭐ {avgRating}</span>
            )}
          </div>
          <div className="mt-3">
            <VanTypeBadge type={van.van_type} />
          </div>
        </div>
      </div>
    </Link>
  )
}

function vanTypeEmoji(type: string): string {
  const map: Record<string, string> = {
    fish_and_chips: '🐟',
    burger: '🍔',
    coffee: '☕',
    ice_cream: '🍦',
    pizza: '🍕',
    dessert: '🍰',
    street_food: '🍜',
    catering_trailer: '🚚',
    other: '🚐',
  }
  return map[type] ?? '🚐'
}
