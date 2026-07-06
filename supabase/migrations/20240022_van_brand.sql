-- ============================================================================
-- VAN BRAND / DESIGN
-- Per-van brand theme captured by AI from the owner's uploaded design
-- (menu poster, van livery photo, or logo). Applied to the public van page.
-- ============================================================================

ALTER TABLE vans ADD COLUMN IF NOT EXISTS brand JSONB;
-- brand shape:
-- {
--   "primary":   "#1ca3dd",  -- main brand colour (buttons, highlights)
--   "secondary": "#f97316",  -- supporting colour (gradients)
--   "accent":    "#ffd166",  -- small highlights (prices, badges)
--   "bg":        "dark" | "light",
--   "logo_text": "Howe & Co" -- optional stylised name from the design
-- }
