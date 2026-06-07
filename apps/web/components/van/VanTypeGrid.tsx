import Link from 'next/link'
import { VAN_TYPES } from '@/lib/utils/constants'

const EMOJIS: Record<string, string> = {
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

export function VanTypeGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {VAN_TYPES.map(t => (
        <Link
          key={t.value}
          href={`/search?type=${t.value}`}
          className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all group"
        >
          <span className="text-4xl mb-3">{EMOJIS[t.value]}</span>
          <span className="text-sm font-medium text-gray-700 group-hover:text-brand-500 text-center">{t.label}</span>
        </Link>
      ))}
    </div>
  )
}
