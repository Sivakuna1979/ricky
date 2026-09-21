CREATE POLICY "menu_items_owner_all" ON menu_items
  FOR ALL USING (
    category_id IN (
      SELECT menu_categories.id
      FROM menu_categories
      INNER JOIN menus ON menus.id = menu_categories.menu_id
      WHERE menus.van_id IN (SELECT my_van_ids())
    )
    OR is_super_admin()
  );

CREATE POLICY "menu_items_public_read" ON menu_items FOR SELECT USING (is_available = true);

CREATE POLICY "menu_item_options_owner_all" ON menu_item_options
  FOR ALL USING (
    menu_item_id IN (
      SELECT menu_items.id
      FROM menu_items
      INNER JOIN menu_categories ON menu_categories.id = menu_items.category_id
      INNER JOIN menus ON menus.id = menu_categories.menu_id
      WHERE menus.van_id IN (SELECT my_van_ids())
    )
    OR is_super_admin()
  );

CREATE POLICY "menu_item_options_public_read" ON menu_item_options FOR SELECT USING (true);

CREATE POLICY "menu_item_option_choices_owner_all" ON menu_item_option_choices
  FOR ALL USING (
    option_id IN (
      SELECT menu_item_options.id
      FROM menu_item_options
      INNER JOIN menu_items ON menu_items.id = menu_item_options.menu_item_id
      INNER JOIN menu_categories ON menu_categories.id = menu_items.category_id
      INNER JOIN menus ON menus.id = menu_categories.menu_id
      WHERE menus.van_id IN (SELECT my_van_ids())
    )
    OR is_super_admin()
  );

CREATE POLICY "menu_item_option_choices_public_read" ON menu_item_option_choices FOR SELECT USING (true);

CREATE POLICY "customers_own" ON customers FOR ALL USING (user_id = auth_user_id() OR is_super_admin());

CREATE POLICY "orders_super_admin" ON orders FOR ALL USING (is_super_admin());
CREATE POLICY "orders_customer_own" ON orders FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id()));
CREATE POLICY "orders_van_owner_read" ON orders FOR SELECT USING (van_id IN (SELECT my_van_ids()));
CREATE POLICY "orders_van_owner_update_status" ON orders FOR UPDATE USING (van_id IN (SELECT my_van_ids()));

CREATE POLICY "order_items_follow_order" ON order_items
  FOR ALL USING (
    order_id IN (
      SELECT id FROM orders
      WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id())
      OR van_id IN (SELECT my_van_ids())
    )
    OR is_super_admin()
  );

CREATE POLICY "payments_super_admin" ON payments FOR ALL USING (is_super_admin());
CREATE POLICY "payments_customer_read" ON payments FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id())));
CREATE POLICY "payments_owner_read" ON payments FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE van_id IN (SELECT my_van_ids())));

CREATE POLICY "subscriptions_super_admin" ON subscriptions FOR ALL USING (is_super_admin());
CREATE POLICY "subscriptions_owner" ON subscriptions FOR ALL USING (business_id IN (SELECT my_business_ids()));
CREATE POLICY "subscription_plans_public_read" ON subscription_plans FOR SELECT USING (is_active = true);

CREATE POLICY "hygiene_logs_owner" ON hygiene_logs FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());
CREATE POLICY "temperature_logs_owner" ON temperature_logs FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());
CREATE POLICY "cleaning_logs_owner" ON cleaning_logs FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());
CREATE POLICY "haccp_records_owner" ON haccp_records FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());
CREATE POLICY "hygiene_documents_owner" ON hygiene_documents FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());
CREATE POLICY "allergen_info_owner" ON allergen_info FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());
CREATE POLICY "supplier_records_owner" ON supplier_records FOR ALL USING (business_id IN (SELECT my_business_ids()) OR is_super_admin());

CREATE POLICY "reviews_public_read" ON reviews FOR SELECT USING (is_published = true);
CREATE POLICY "reviews_customer_own" ON reviews FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id()));
CREATE POLICY "reviews_owner_read" ON reviews FOR SELECT USING (van_id IN (SELECT my_van_ids()));

CREATE POLICY "imported_businesses_super_admin" ON imported_businesses FOR ALL USING (is_super_admin());
CREATE POLICY "imported_businesses_public_read" ON imported_businesses FOR SELECT USING (true);

CREATE POLICY "leads_super_admin" ON leads FOR ALL USING (is_super_admin());
CREATE POLICY "sales_agent_messages_super_admin" ON sales_agent_messages FOR ALL USING (is_super_admin());

CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "audit_logs_super_admin" ON audit_logs FOR SELECT USING (is_super_admin());
CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "favourites_own" ON customer_favourite_vans
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id())
  );
