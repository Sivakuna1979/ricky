-- ============================================================================
-- Lets a business owner send a one-off promo/offer email to past customers
-- (built from guest_email on their own orders — no separate mailing list to
-- manage). email_unsubscribes is a simple global opt-out list, checked
-- before every marketing send, since UK/EU marketing email rules require a
-- working one-click unsubscribe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  email             TEXT PRIMARY KEY,
  unsubscribed_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Anyone can unsubscribe themselves via the link in an email — no login.
DROP POLICY IF EXISTS "email_unsubscribes_insert_public" ON email_unsubscribes;
CREATE POLICY "email_unsubscribes_insert_public" ON email_unsubscribes
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "email_unsubscribes_super_admin" ON email_unsubscribes;
CREATE POLICY "email_unsubscribes_super_admin" ON email_unsubscribes
  FOR SELECT USING (is_super_admin());
