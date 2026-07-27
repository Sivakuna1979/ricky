-- ============================================================================
-- Fix: deleting an order (admin cleanup tool) failed with
-- "violates foreign key constraint whatsapp_messages_order_id_fkey"
-- whenever that order came in via WhatsApp — the FK had no ON DELETE
-- behaviour at all, so Postgres blocked the delete outright. Same latent
-- issue exists for payments and reviews, just not hit yet.
-- ============================================================================

-- payments rows belong to their order (like order_items already does) —
-- deleting the order should remove its payment record too.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- whatsapp_messages is a dedup/audit log keyed by Meta's message id — if we
-- delete the row instead of just unlinking it, a retried webhook delivery
-- for that same message id would no longer be recognised as already
-- processed, and could recreate a duplicate order. Unlink, don't delete.
ALTER TABLE whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_order_id_fkey;
ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- A review is the customer's own content — keep it, just detach it from a
-- deleted order rather than losing it.
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_order_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
