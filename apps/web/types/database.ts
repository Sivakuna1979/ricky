// Auto-generated types from Supabase schema
// Run: npm run db:types to regenerate

export type UserRole = 'super_admin' | 'business_owner' | 'van_manager' | 'driver' | 'staff' | 'customer'
export type BusinessStatus = 'pending' | 'approved' | 'suspended' | 'rejected'
export type VanType = 'fish_and_chips' | 'burger' | 'coffee' | 'ice_cream' | 'pizza' | 'dessert' | 'street_food' | 'catering_trailer' | 'other'
export type TrackingStatus = 'live' | 'paused' | 'offline'
export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'collected' | 'cancelled'
export type PaymentMethod = 'card_online' | 'cash_at_van' | 'card_at_van'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'unpaid'
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'trial_started' | 'subscribed' | 'not_interested'
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface User {
  id: string
  auth_id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  gdpr_consent: boolean
  gdpr_consent_at: string | null
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface Business {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  business_type: VanType
  logo_url: string | null
  cover_image_url: string | null
  email: string | null
  phone: string | null
  website: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  postcode: string | null
  country: string
  companies_house_number: string | null
  vat_number: string | null
  food_hygiene_rating: number | null
  fsa_establishment_id: string | null
  status: BusinessStatus
  is_claimed: boolean
  claimed_at: string | null
  stripe_customer_id: string | null
  stripe_account_id: string | null
  allow_cash_payments: boolean
  allow_card_at_van: boolean
  google_place_id: string | null
  created_at: string
  updated_at: string
}

export interface Van {
  id: string
  business_id: string
  name: string
  slug: string
  description: string | null
  van_type: VanType
  registration_plate: string | null
  profile_image_url: string | null
  cover_image_url: string | null
  tracking_status: TrackingStatus
  is_active: boolean
  accepts_online_orders: boolean
  accepts_cash: boolean
  accepts_card_at_van: boolean
  created_at: string
  updated_at: string
}

export interface QrCode {
  id: string
  van_id: string
  code: string
  url: string
  qr_image_url: string | null
  scan_count: number
  created_at: string
}

export interface VanRoute {
  id: string
  van_id: string
  day_of_week: DayOfWeek
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RouteStop {
  id: string
  route_id: string
  name: string
  address: string | null
  postcode: string
  latitude: number | null
  longitude: number | null
  arrival_time: string
  leaving_time: string
  notes: string | null
  stop_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LiveLocation {
  id: string
  van_id: string
  driver_id: string | null
  latitude: number
  longitude: number
  heading: number | null
  speed: number | null
  accuracy: number | null
  recorded_at: string
}

export interface Menu {
  id: string
  van_id: string
  name: string
  is_active: boolean
  vat_enabled: boolean
  vat_rate: number
  created_at: string
  updated_at: string
}

export interface MenuCategory {
  id: string
  menu_id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  is_featured: boolean
  allergens: string[] | null
  calories: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MenuItemOption {
  id: string
  menu_item_id: string
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  created_at: string
  choices?: MenuItemOptionChoice[]
}

export interface MenuItemOptionChoice {
  id: string
  option_id: string
  name: string
  price_modifier: number
  is_available: boolean
}

export interface Order {
  id: string
  order_number: string
  customer_id: string
  van_id: string
  stop_id: string | null
  status: OrderStatus
  payment_method: PaymentMethod
  subtotal: number
  vat_amount: number
  total: number
  notes: string | null
  collection_time: string | null
  accepted_at: string | null
  preparing_at: string | null
  ready_at: string | null
  collected_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  name: string
  price: number
  quantity: number
  options: Record<string, string> | null
  item_total: number
  created_at: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price_monthly: number
  price_yearly: number
  max_vans: number
  features: Record<string, boolean> | null
  stripe_price_id_monthly: string | null
  stripe_price_id_yearly: string | null
  is_active: boolean
  created_at: string
}

export interface Subscription {
  id: string
  business_id: string
  plan_id: string
  stripe_subscription_id: string | null
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface TemperatureLog {
  id: string
  business_id: string
  van_id: string | null
  log_type: string
  equipment_name: string | null
  temperature_celsius: number
  min_safe_temp: number | null
  max_safe_temp: number | null
  is_within_range: boolean | null
  recorded_by: string
  recorded_at: string
  corrective_action: string | null
}

export interface Lead {
  id: string
  imported_business_id: string | null
  business_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  area: string | null
  status: LeadStatus
  source: string | null
  onboarding_token: string | null
  onboarding_url: string | null
  trial_started_at: string | null
  subscribed_at: string | null
  notes: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}

export interface ImportedBusiness {
  id: string
  google_place_id: string | null
  fsa_establishment_id: string | null
  name: string
  business_type: VanType
  address: string | null
  city: string | null
  county: string | null
  postcode: string | null
  phone: string | null
  website: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  google_rating: number | null
  fsa_hygiene_rating: number | null
  source: string
  is_claimed: boolean
  claimed_by: string | null
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

// Basket (client-side only)
export interface BasketItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  options: Record<string, string>
  itemTotal: number
}

// Database type (used with Supabase client generics)
export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> }
      businesses: { Row: Business; Insert: Partial<Business>; Update: Partial<Business> }
      vans: { Row: Van; Insert: Partial<Van>; Update: Partial<Van> }
      qr_codes: { Row: QrCode; Insert: Partial<QrCode>; Update: Partial<QrCode> }
      van_routes: { Row: VanRoute; Insert: Partial<VanRoute>; Update: Partial<VanRoute> }
      route_stops: { Row: RouteStop; Insert: Partial<RouteStop>; Update: Partial<RouteStop> }
      live_locations: { Row: LiveLocation; Insert: Partial<LiveLocation>; Update: Partial<LiveLocation> }
      menus: { Row: Menu; Insert: Partial<Menu>; Update: Partial<Menu> }
      menu_categories: { Row: MenuCategory; Insert: Partial<MenuCategory>; Update: Partial<MenuCategory> }
      menu_items: { Row: MenuItem; Insert: Partial<MenuItem>; Update: Partial<MenuItem> }
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order> }
      order_items: { Row: OrderItem; Insert: Partial<OrderItem>; Update: Partial<OrderItem> }
      subscription_plans: { Row: SubscriptionPlan; Insert: Partial<SubscriptionPlan>; Update: Partial<SubscriptionPlan> }
      subscriptions: { Row: Subscription; Insert: Partial<Subscription>; Update: Partial<Subscription> }
      temperature_logs: { Row: TemperatureLog; Insert: Partial<TemperatureLog>; Update: Partial<TemperatureLog> }
      leads: { Row: Lead; Insert: Partial<Lead>; Update: Partial<Lead> }
      imported_businesses: { Row: ImportedBusiness; Insert: Partial<ImportedBusiness>; Update: Partial<ImportedBusiness> }
    }
    Functions: {
      auth_user_id: { Args: Record<never, never>; Returns: string }
      is_super_admin: { Args: Record<never, never>; Returns: boolean }
      increment_qr_scan: { Args: { code_value: string }; Returns: void }
    }
  }
}
