-- ============================================================================
-- Lets a business owner manually reorder their menu categories (e.g. move
-- "Desserts" — which is really sauces — away from the top) instead of being
-- stuck with alphabetical order.
-- ============================================================================

ALTER TABLE vans ADD COLUMN IF NOT EXISTS category_order TEXT[] DEFAULT '{}';
