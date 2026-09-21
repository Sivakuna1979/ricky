-- Food Taxi Platform - DB Functions & Triggers

-- Auto-update updated_at on any table that has it
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_businesses BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_vans BEFORE UPDATE ON vans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_van_routes BEFORE UPDATE ON van_routes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_route_stops BEFORE UPDATE ON route_stops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_menus BEFORE UPDATE ON menus
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_menu_items BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_subscriptions BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_allergen_info BEFORE UPDATE ON allergen_info
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_imported_businesses BEFORE UPDATE ON imported_businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_leads BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create user record when auth.users entry is created
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Auto-create customer record when user with role=customer is created
CREATE OR REPLACE FUNCTION handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'customer' THEN
    INSERT INTO public.customers (user_id)
    VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_customer
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_customer();

-- Generate order number
CREATE SEQUENCE order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number = 'FT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
      LPAD(nextval('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Increment QR scan count
CREATE OR REPLACE FUNCTION increment_qr_scan(code_value TEXT)
RETURNS VOID AS $$
  UPDATE qr_codes SET scan_count = scan_count + 1 WHERE code = code_value;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get today's route for a van
CREATE OR REPLACE FUNCTION get_today_route(p_van_id UUID)
RETURNS TABLE(route_id UUID, day day_of_week) AS $$
  SELECT id, day_of_week FROM van_routes
  WHERE van_id = p_van_id
    AND day_of_week = LOWER(TO_CHAR(NOW(), 'day'))::day_of_week
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get hygiene compliance summary for a business (last 30 days)
CREATE OR REPLACE FUNCTION get_hygiene_compliance_summary(p_business_id UUID)
RETURNS TABLE(
  total_logs BIGINT,
  compliant_logs BIGINT,
  non_compliant_logs BIGINT,
  compliance_rate DECIMAL
) AS $$
  SELECT
    COUNT(*) as total_logs,
    COUNT(*) FILTER (WHERE is_within_range = true) as compliant_logs,
    COUNT(*) FILTER (WHERE is_within_range = false) as non_compliant_logs,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(COUNT(*) FILTER (WHERE is_within_range = true)::DECIMAL / COUNT(*) * 100, 2)
    END as compliance_rate
  FROM temperature_logs
  WHERE business_id = p_business_id
    AND recorded_at >= NOW() - INTERVAL '30 days';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE live_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE vans;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
