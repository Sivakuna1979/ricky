-- ============================================================
-- VanTrack Platform — Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vans ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE van_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_option_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hygiene_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hygiene_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergen_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_favourite_vans ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's internal ID
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: get businesses owned by current user
CREATE OR REPLACE FUNCTION my_business_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM businesses WHERE owner_id = auth_user_id()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: get van IDs accessible to current user (owner + staff)
CREATE OR REPLACE FUNCTION my_van_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM vans WHERE business_id IN (SELECT my_business_ids())
  UNION
  SELECT van_id FROM staff WHERE user_id = auth_user_id() AND van_id IS NOT NULL AND is_active = true
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- USERS
-- ============================================================
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth_id = auth.uid() OR is_super_admin());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth_id = auth.uid());

-- ============================================================
-- BUSINESSES
-- ============================================================
CREATE POLICY "businesses_super_admin" ON businesses
  FOR ALL USING (is_super_admin());

CREATE POLICY "businesses_owner_read_write" ON businesses
  FOR ALL USING (owner_id = auth_user_id());

CREATE POLICY "businesses_public_read_approved" ON businesses
  FOR SELECT USING (status = 'approved');

-- ============================================================
-- VANS
-- ============================================================
CREATE POLICY "vans_super_admin" ON vans
  FOR ALL USING (is_super_admin());

CREATE POLICY "vans_owner_all" ON vans
  FOR ALL USING (business_id IN (SELECT my_business_ids()));

CREATE POLICY "vans_staff_read" ON vans
  FOR SELECT USING (id IN (
    SELECT van_id FROM staff WHERE user_id = auth_user_id() AND is_active = true
  ));

CREATE POLICY "vans_public_read_active" ON vans
  FOR SELECT USING (is_active = true);

-- ============================================================
-- QR CODES
-- ============================================================
CREATE POLICY "qr_codes_owner" ON qr_codes
  FOR ALL USING (van_id IN (SELECT my_van_ids()) OR is_super_admin());

CREATE POLICY "qr_codes_public_read" ON qr_codes
  FOR SELECT USING (true);

-- ============================================================
-- STAFF
-- ============================================================
CREATE POLICY "staff_owner_manage" ON staff
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());

CREATE POLICY "staff_self_read" ON staff
  FOR SELECT USING (user_id = auth_user_id());

-- ============================================================
-- VAN ROUTES
-- ============================================================
CREATE POLICY "routes_owner_all" ON van_routes
  FOR ALL USING (van_id IN (SELECT my_van_ids()) OR is_super_admin());

CREATE POLICY "routes_public_read_active" ON van_routes
  FOR SELECT USING (is_active = true);

-- ============================================================
-- ROUTE STOPS
-- ============================================================
CREATE POLICY "stops_owner_all" ON route_stops
  FOR ALL USING (
    route_id IN (SELECT id FROM van_routes WHERE van_id IN (SELECT my_van_ids()))
    OR is_super_admin()
  );

CREATE POLICY "stops_public_read" ON route_stops
  FOR SELECT USING (is_active = true);

-- ============================================================
-- LIVE LOCATIONS
-- ============================================================
CREATE POLICY "live_locations_driver_insert" ON live_locations
  FOR INSERT WITH CHECK (
    van_id IN (SELECT my_van_ids()) OR is_super_admin()
  );

CREATE POLICY "live_locations_public_read" ON live_locations
  FOR SELECT USING (true);

CREATE POLICY "live_locations_owner_all" ON live_locations
  FOR ALL USING (van_id IN (SELECT my_van_ids()) OR is_super_admin());

-- ============================================================
-- MENUS
-- ============================================================
CREATE POLICY "menus_owner_all" ON menus
  FOR ALL USING (van_id IN (SELECT my_van_ids()) OR is_super_admin());

CREATE POLICY "menus_public_read_active" ON menus
  FOR SELECT USING (is_active = true);

CREATE POLICY "menu_categories_owner_all" ON menu_categories
  FOR ALL USING (
    menu_id IN (SELECT id FROM menus WHERE van_id IN (SELECT my_van_ids()))
    OR is_super_admin()
  );

CREATE POLICY "menu_categories_public_read" ON menu_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "menu_items_owner_all" ON menu_items
  FOR ALL USING (
    category_id IN (
      SELECT mc.id FROM menu_categories mc
      JOIN menus m ON m.id = mc.menu_id
      WHERE m.van_id IN (SELECT my_van_ids())
    )
    OR is_super_admin()
  );

CREATE POLICY "menu_items_public_read" ON menu_items
  FOR SELECT USING (is_available = true);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE POLICY "customers_own" ON customers
  FOR ALL USING (user_id = auth_user_id() OR is_super_admin());

-- ============================================================
-- ORDERS
-- ============================================================
CREATE POLICY "orders_super_admin" ON orders
  FOR ALL USING (is_super_admin());

CREATE POLICY "orders_customer_own" ON orders
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id())
  );

CREATE POLICY "orders_van_owner_read" ON orders
  FOR SELECT USING (van_id IN (SELECT my_van_ids()));

CREATE POLICY "orders_van_owner_update_status" ON orders
  FOR UPDATE USING (van_id IN (SELECT my_van_ids()));

CREATE POLICY "order_items_follow_order" ON order_items
  FOR ALL USING (
    order_id IN (
      SELECT id FROM orders WHERE
        customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id())
        OR van_id IN (SELECT my_van_ids())
    )
    OR is_super_admin()
  );

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE POLICY "payments_super_admin" ON payments
  FOR ALL USING (is_super_admin());

CREATE POLICY "payments_customer_read" ON payments
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id IN (
        SELECT id FROM customers WHERE user_id = auth_user_id()
      )
    )
  );

CREATE POLICY "payments_owner_read" ON payments
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE van_id IN (SELECT my_van_ids()))
  );

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE POLICY "subscriptions_super_admin" ON subscriptions
  FOR ALL USING (is_super_admin());

CREATE POLICY "subscriptions_owner" ON subscriptions
  FOR ALL USING (business_id IN (SELECT my_business_ids()));

CREATE POLICY "subscription_plans_public_read" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- ============================================================
-- HYGIENE
-- ============================================================
CREATE POLICY "hygiene_logs_owner" ON hygiene_logs
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());

CREATE POLICY "temperature_logs_owner" ON temperature_logs
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());

CREATE POLICY "cleaning_logs_owner" ON cleaning_logs
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());

CREATE POLICY "haccp_records_owner" ON haccp_records
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());

CREATE POLICY "hygiene_documents_owner" ON hygiene_documents
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());

CREATE POLICY "allergen_info_owner" ON allergen_info
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());

CREATE POLICY "supplier_records_owner" ON supplier_records
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (is_published = true);

CREATE POLICY "reviews_customer_own" ON reviews
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id())
  );

CREATE POLICY "reviews_owner_read" ON reviews
  FOR SELECT USING (van_id IN (SELECT my_van_ids()));

-- ============================================================
-- DISCOVERY & LEADS
-- ============================================================
CREATE POLICY "imported_businesses_super_admin" ON imported_businesses
  FOR ALL USING (is_super_admin());

CREATE POLICY "imported_businesses_public_read" ON imported_businesses
  FOR SELECT USING (true);

CREATE POLICY "leads_super_admin" ON leads
  FOR ALL USING (is_super_admin());

CREATE POLICY "sales_agent_messages_super_admin" ON sales_agent_messages
  FOR ALL USING (is_super_admin());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = auth_user_id());

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE POLICY "audit_logs_super_admin" ON audit_logs
  FOR SELECT USING (is_super_admin());

CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- FAVOURITES
-- ============================================================
CREATE POLICY "favourites_own" ON customer_favourite_vans
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id())
  );
