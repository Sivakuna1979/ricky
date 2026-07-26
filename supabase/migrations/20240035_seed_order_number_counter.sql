-- ============================================================================
-- Fix: the daily order-number counter (20240034) started every date fresh
-- at 1 with no knowledge of orders already created that day before the
-- counter table existed — so the next real order collided with an
-- already-used order_number and hit "duplicate key value violates unique
-- constraint orders_order_number_key".
--
-- One-off repair: raise each date's counter to at least the highest
-- suffix already used for that date, derived straight from existing
-- order_number values. Safe to re-run — only ever raises the floor.
-- ============================================================================

INSERT INTO order_number_counters (order_date, counter)
SELECT
  TO_DATE(substring(order_number FROM 'FT-(\d{8})-'), 'YYYYMMDD') AS order_date,
  MAX(substring(order_number FROM '-(\d{4})$')::int) AS max_n
FROM orders
WHERE order_number ~ '^FT-\d{8}-\d{4}$'
GROUP BY 1
ON CONFLICT (order_date) DO UPDATE
  SET counter = GREATEST(order_number_counters.counter, EXCLUDED.counter);
