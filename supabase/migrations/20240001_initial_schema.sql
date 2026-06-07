-- ============================================================
-- VanTrack Platform — Initial Database Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM (
  'super_admin', 'business_owner', 'van_manager', 'driver', 'staff', 'customer'
);

CREATE TYPE business_status AS ENUM (
  'pending', 'approved', 'suspended', 'rejected'
);

CREATE TYPE van_type AS ENUM (
  'fish_and_chips', 'burger', 'coffee', 'ice_cream', 'pizza',
  'dessert', 'street_food', 'catering_trailer', 'other'
);

CREATE TYPE tracking_status AS ENUM ('live', 'paused', 'offline');

CREATE TYPE order_status AS ENUM (
  'pending', 'accepted', 'preparing', 'ready', 'collected', 'cancelled'
);

CREATE TYPE payment_method AS ENUM ('card_online', 'cash_at_van', 'card_at_van');

CREATE TYPE subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'cancelled', 'unpaid'
);

CREATE TYPE lead_status AS ENUM (
  'new', 'contacted', 'interested', 'trial_started', 'subscribed', 'not_interested'
);

CREATE TYPE hygiene_log_type AS ENUM (
  'fridge_temp', 'freezer_temp', 'hot_holding_temp', 'cooking_temp',
  'cleaning', 'opening_checklist', 'closing_checklist', 'daily_hygiene',
  'staff_hygiene', 'haccp', 'supplier', 'maintenance'
);

CREATE TYPE day_of_week AS ENUM (
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  gdpr_consent BOOLEAN DEFAULT false,
  gdpr_consent_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUSINESSES
-- ============================================================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  business_type van_type NOT NULL DEFAULT 'other',
  logo_url TEXT,
  cover_image_url TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  county TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'GB',
  location GEOGRAPHY(POINT, 4326),
  companies_house_number TEXT,
  vat_number TEXT,
  food_hygiene_rating INTEGER CHECK (food_hygiene_rating BETWEEN 0 AND 5),
  fsa_establishment_id TEXT,
  status business_status DEFAULT 'pending',
  is_claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_account_id TEXT,
  allow_cash_payments BOOLEAN DEFAULT true,
  allow_card_at_van BOOLEAN DEFAULT true,
  google_place_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VANS
-- ============================================================
CREATE TABLE vans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  van_type van_type NOT NULL DEFAULT 'other',
  registration_plate TEXT,
  profile_image_url TEXT,
  cover_image_url TEXT,
  tracking_status tracking_status DEFAULT 'offline',
  is_active BOOLEAN DEFAULT true,
  accepts_online_orders BOOLEAN DEFAULT true,
  accepts_cash BOOLEAN DEFAULT true,
  accepts_card_at_van BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QR CODES
-- ============================================================
CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  van_id UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  qr_image_url TEXT,
  scan_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAFF
-- ============================================================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id UUID REFERENCES vans(id),
  role user_role NOT NULL,
  is_active BOOLEAN DEFAULT true,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE (business_id, user_id)
);

-- ============================================================
-- VAN ROUTES
-- ============================================================
CREATE TABLE van_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  van_id UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (van_id, day_of_week)
);

-- ============================================================
-- ROUTE STOPS
-- ============================================================
CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES van_routes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  postcode TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  arrival_time TIME NOT NULL,
  leaving_time TIME NOT NULL,
  notes TEXT,
  stop_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LIVE LOCATIONS
-- ============================================================
CREATE TABLE live_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  van_id UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_live_locations_van_id ON live_locations(van_id);
CREATE INDEX idx_live_locations_recorded_at ON live_locations(recorded_at DESC);

-- ============================================================
-- MENUS
-- ============================================================
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  van_id UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Menu',
  is_active BOOLEAN DEFAULT true,
  vat_enabled BOOLEAN DEFAULT false,
  vat_rate DECIMAL(5,2) DEFAULT 20.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  allergens TEXT[],
  calories INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE menu_item_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_required BOOLEAN DEFAULT false,
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE menu_item_option_choices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id UUID NOT NULL REFERENCES menu_item_options(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_modifier DECIMAL(10,2) DEFAULT 0.00,
  is_available BOOLEAN DEFAULT true
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_postcode TEXT,
  push_token TEXT,
  notification_van_nearby BOOLEAN DEFAULT true,
  notification_order_ready BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  van_id UUID NOT NULL REFERENCES vans(id),
  stop_id UUID REFERENCES route_stops(id),
  status order_status DEFAULT 'pending',
  payment_method payment_method NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL,
  notes TEXT,
  collection_time TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  preparing_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  options JSONB,
  item_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'gbp',
  status TEXT NOT NULL,
  payment_method payment_method NOT NULL,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  max_vans INTEGER NOT NULL,
  features JSONB,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  stripe_subscription_id TEXT UNIQUE,
  status subscription_status DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HYGIENE
-- ============================================================
CREATE TABLE hygiene_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id UUID REFERENCES vans(id),
  log_type hygiene_log_type NOT NULL,
  recorded_by UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB NOT NULL,
  digital_signature TEXT,
  notes TEXT,
  is_compliant BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE temperature_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id UUID REFERENCES vans(id),
  log_type TEXT NOT NULL,
  equipment_name TEXT,
  temperature_celsius DECIMAL(5,2) NOT NULL,
  min_safe_temp DECIMAL(5,2),
  max_safe_temp DECIMAL(5,2),
  is_within_range BOOLEAN,
  recorded_by UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  corrective_action TEXT
);

CREATE TABLE cleaning_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id UUID REFERENCES vans(id),
  area TEXT NOT NULL,
  method TEXT,
  chemical_used TEXT,
  completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE haccp_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id UUID REFERENCES vans(id),
  hazard_type TEXT NOT NULL,
  control_measure TEXT,
  critical_limit TEXT,
  monitoring_procedure TEXT,
  corrective_action TEXT,
  verification TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hygiene_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id UUID REFERENCES vans(id),
  name TEXT NOT NULL,
  document_type TEXT,
  file_url TEXT NOT NULL,
  expires_at DATE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE allergen_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id UUID REFERENCES vans(id),
  document_url TEXT,
  last_reviewed_at DATE,
  reviewed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE supplier_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  products_supplied TEXT[],
  approved BOOLEAN DEFAULT false,
  approved_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  van_id UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DISCOVERY
-- ============================================================
CREATE TABLE imported_businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_place_id TEXT UNIQUE,
  fsa_establishment_id TEXT,
  name TEXT NOT NULL,
  business_type van_type DEFAULT 'other',
  address TEXT,
  city TEXT,
  county TEXT,
  postcode TEXT,
  phone TEXT,
  website TEXT,
  email TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  google_rating DECIMAL(3,2),
  fsa_hygiene_rating INTEGER,
  source TEXT NOT NULL,
  is_claimed BOOLEAN DEFAULT false,
  claimed_by UUID REFERENCES businesses(id),
  claim_requested_at TIMESTAMPTZ,
  claim_approved_at TIMESTAMPTZ,
  invitation_sent_at TIMESTAMPTZ,
  invitation_method TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imported_business_id UUID REFERENCES imported_businesses(id),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  area TEXT,
  status lead_status DEFAULT 'new',
  source TEXT,
  onboarding_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  onboarding_url TEXT,
  trial_started_at TIMESTAMPTZ,
  subscribed_at TIMESTAMPTZ,
  notes TEXT,
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales_agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  ai_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FAVOURITES
-- ============================================================
CREATE TABLE customer_favourite_vans (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  van_id UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, van_id)
);

-- ============================================================
-- SEED: Default subscription plans
-- ============================================================
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_vans, features) VALUES
  ('Starter', 'Perfect for a single van', 29.00, 290.00, 1, '{"live_tracking": true, "online_orders": true, "hygiene_logs": true, "qr_code": true}'::jsonb),
  ('Pro', 'For growing businesses with up to 3 vans', 59.00, 590.00, 3, '{"live_tracking": true, "online_orders": true, "hygiene_logs": true, "qr_code": true, "analytics": true, "staff_management": true}'::jsonb),
  ('Enterprise', 'Unlimited vans for large operations', 99.00, 990.00, 999, '{"live_tracking": true, "online_orders": true, "hygiene_logs": true, "qr_code": true, "analytics": true, "staff_management": true, "api_access": true, "priority_support": true}'::jsonb);
