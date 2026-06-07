import type { VanType } from '@/types/database'

export const VAN_TYPES: { value: VanType; label: string; emoji: string }[] = [
  { value: 'fish_and_chips', label: 'Fish & Chips', emoji: '🐟' },
  { value: 'burger', label: 'Burger Van', emoji: '🍔' },
  { value: 'coffee', label: 'Coffee Van', emoji: '☕' },
  { value: 'ice_cream', label: 'Ice Cream Van', emoji: '🍦' },
  { value: 'pizza', label: 'Pizza Van', emoji: '🍕' },
  { value: 'dessert', label: 'Dessert Van', emoji: '🍰' },
  { value: 'street_food', label: 'Street Food', emoji: '🍜' },
  { value: 'catering_trailer', label: 'Catering Trailer', emoji: '🚚' },
  { value: 'other', label: 'Other', emoji: '🚐' },
]

export const VAN_TYPE_LABELS: Record<VanType, string> = Object.fromEntries(
  VAN_TYPES.map(t => [t.value, t.label])
) as Record<VanType, string>

export const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready to Collect',
  collected: 'Collected',
  cancelled: 'Cancelled',
} as const

export const ORDER_STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready: 'bg-green-100 text-green-800',
  collected: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
} as const

export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

export const SAFE_TEMP_RANGES = {
  fridge_temp: { min: 0, max: 8, label: 'Fridge (0–8°C)' },
  freezer_temp: { min: -25, max: -18, label: 'Freezer (-18°C or below)' },
  hot_holding_temp: { min: 63, max: 100, label: 'Hot Holding (63°C+)' },
  cooking_temp: { min: 75, max: 100, label: 'Cooking (75°C+)' },
} as const
