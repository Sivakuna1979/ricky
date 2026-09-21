-- ============================================================================
-- PHASE M — Franchise, Group & Multi-Business Management.
--
-- M1 AUDIT FINDINGS (full write-up in docs/FOODTAXI-TECHNICAL-BASELINE.md):
--   - `businesses` has NO group/franchise/parent column of any kind, and no
--     ALTER TABLE in the whole migration history ever added one — this is a
--     genuinely green-field addition, nothing to migrate away from.
--   - `staff.UNIQUE(business_id, user_id)` was already DROPPED in Phase C
--     (20240050, for multi-van assignment) — nothing at the DB level stops
--     one user having rows across several businesses, or now several
--     groups. The RLS helper functions (`my_business_ids()`,
--     `my_staff_business_ids()`) are already `SETOF UUID` — genuinely
--     multi-row-safe already. The single-business assumption in this app
--     is entirely an API-layer choice (`lib/staffContext.ts`'s
--     `getStaffContext()` picks "first business found" when no explicit
--     hint is given) — Phase M's real engineering work is a session/
--     business-selection layer (M90's scope switcher), not new RLS.
--   - `business_memory` (Phase F) and `notifications` (Phase D) are both
--     strictly single-business/single-user with NOT NULL FKs — no
--     nullable/group-parallel path exists for "group document" or "group
--     announcement" today. Both get genuinely new tables below; group
--     announcements FAN OUT into the existing `notifications` table for
--     delivery (reusing NotificationCentre, never a parallel inbox).
--   - The existing "claim a business" flow (app/api/places/claim) keys
--     strictly off `google_place_id`, never a name/brand string — the
--     precedent this migration's group↔business linkage follows: a group
--     always selects an EXISTING business by its real id (never by
--     matching a name string) and the business owner must explicitly
--     accept (M10) — never a silent/automatic claim.
--   - `audit_logs` (Phase C) is already a generic actor/action/entity
--     table — reused as-is for every group action below; no new audit
--     table.
--
-- CORE SECURITY PRINCIPLE (repeated here because it drives every table
-- below): group membership never implies unlimited access. Business-level
-- RLS (orders, customers, finance, staff, documents, payment/accounting
-- connections) is NOT touched by this migration at all — no policy below
-- ever adds "OR business_id IN (a group's businesses)" to an existing
-- table. Every group-level aggregate (sales summary, stock summary, etc.)
-- is computed in the API layer by an explicitly permission-checked route
-- querying each authorised business_id individually via the service-role
-- client — exactly the same pattern Phase K's Command Centre already uses
-- across a business's own vans, one level up. New tables below get their
-- OWN RLS, scoped by group membership, never by "same group" on an
-- existing business table.
--
-- DECISION (M5): a business may hold at most one ACTIVE group membership
-- at a time (enforced by a partial unique index below) — the simplest
-- safe model. Multi-group membership was audited and rejected for this
-- phase: it would require resolving territory/price-policy/template
-- conflicts across two unrelated franchises simultaneously, a real
-- liability question nothing in this phase's brief defines. A business
-- can freely leave one group and join another; it just can't be active in
-- two at once. Documented in docs/FOODTAXI-TECHNICAL-BASELINE.md.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- M1-M4 — the organisation entity itself. `owner_user_id` is the
-- creating/primary Group Owner, exactly mirroring `businesses.owner_id`'s
-- existing pattern — an owner is never merely "staff" of their own group.
-- `type` is a label only (M4: "labels do not determine access") — every
-- permission check in this phase is against `group_staff.role`/explicit
-- permissions, never `business_groups.type`.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_groups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  type           TEXT NOT NULL DEFAULT 'BUSINESS_GROUP' CHECK (type IN ('FRANCHISE', 'BUSINESS_GROUP', 'REGIONAL_GROUP', 'OTHER')),
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  -- Accessibility-safe defaults applied in the app layer (never a raw
  -- unvalidated colour rendered as-is) — see lib/groups/branding.ts.
  branding       JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE business_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS group_regions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, name)
);
ALTER TABLE group_regions ENABLE ROW LEVEL SECURITY;

-- M6-M9 — group staff/roles. A SEPARATE table from business `staff`
-- (deliberately not reusing `user_role`, which is already heavily
-- overloaded and platform/business-scoped) — a group role is never a
-- FoodTaxi Super Admin (M33/M71) and never implies any business role.
-- `region_id` scopes a REGIONAL_MANAGER to one region — NULL means
-- unrestricted within the group (mirrors staffContext's vanIds=null
-- convention). UNIQUE(group_id, user_id): one role per user per group —
-- the simplest safe model, avoiding multi-role-per-group conflict
-- resolution nothing in this phase's brief defines.
CREATE TABLE IF NOT EXISTS group_staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('GROUP_OWNER', 'GROUP_ADMIN', 'REGIONAL_MANAGER', 'GROUP_FINANCE', 'GROUP_OPERATIONS', 'GROUP_MARKETING', 'GROUP_VIEWER')),
  region_id   UUID REFERENCES group_regions(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  invited_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_staff_user ON group_staff(user_id) WHERE is_active = true;
ALTER TABLE group_staff ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- M1-M2/M10-M11 — explicit Group <-> Business membership. No silent
-- membership (M2): a row is always created as PENDING by an authorised
-- group role inviting an EXISTING business (selected by its real id, never
-- a name/brand match — see the claim-flow precedent above), and only
-- becomes ACTIVE when that business's own owner explicitly accepts.
-- Leaving/removal moves the row to LEFT/REMOVED — it is NEVER deleted
-- (M11/M82: full lifecycle audit trail preserved) and NEVER cascades to
-- delete anything about the business itself (no ON DELETE CASCADE on
-- business_id from this table onto any business data — deliberately just
-- a linkage row).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_memberships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACTIVE', 'REJECTED', 'REMOVED', 'LEFT')),
  region_id    UUID REFERENCES group_regions(id) ON DELETE SET NULL,
  reference    TEXT, -- e.g. a franchise store number, optional
  policy       JSONB NOT NULL DEFAULT '{}'::jsonb, -- per-membership policy overrides (e.g. price_policy)
  invited_by   UUID REFERENCES users(id),
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES users(id),
  removed_at   TIMESTAMPTZ,
  removed_by   UUID REFERENCES users(id),
  UNIQUE (group_id, business_id)
);
-- M5's decision, enforced: at most one ACTIVE membership per business
-- across ALL groups at a time (a business can still hold historical
-- REMOVED/LEFT rows with other groups).
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_memberships_one_active_per_business ON group_memberships(business_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id, status);
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS helper functions, following the EXACT existing pattern
-- (my_business_ids()/my_staff_business_ids()/is_super_admin(), all
-- STABLE SECURITY DEFINER SETOF UUID) — nothing new invented.
-- ----------------------------------------------------------------------------

-- Groups the caller has an active staff role in (any role) OR owns
-- directly (business_groups.owner_user_id) — mirrors how businesses.id is
-- reachable both via my_business_ids() (owner) and my_staff_business_ids()
-- (staff) as two separate functions; here it's one function since a group
-- owner is always also expected to hold a GROUP_OWNER group_staff row
-- (enforced in application code at group-creation time), but the OR
-- clause is defence in depth in case that invariant is ever violated.
CREATE OR REPLACE FUNCTION my_group_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM business_groups WHERE owner_user_id = auth_user_id()
  UNION
  SELECT group_id FROM group_staff WHERE user_id = auth_user_id() AND is_active = true
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Business ids that are ACTIVE members of a group the caller has ANY
-- active group_staff role in — used ONLY by group-scoped tables below
-- (templates, announcements, documents, transfers) to let a group role
-- read/write group-level records that reference a member business. This
-- is deliberately NEVER used on `orders`, `customers`, `finance_*`,
-- `staff`, `payment_provider_*`, `accounting_*`, or any other sensitive
-- business table — those keep their existing RLS completely unchanged
-- (the Core Security Principle above).
CREATE OR REPLACE FUNCTION my_group_member_business_ids()
RETURNS SETOF UUID AS $$
  SELECT gm.business_id FROM group_memberships gm
  WHERE gm.status = 'ACTIVE' AND gm.group_id IN (SELECT my_group_ids())
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- The reverse direction: groups where a business the caller owns/staffs
-- is an ACTIVE member — lets a MEMBER BUSINESS (not just group staff) read
-- group-level content addressed to its group (templates, supplier
-- directory, documents, announcements) without granting it any group_staff
-- role. Actual WRITE authorisation for group content is still enforced in
-- the API layer against the caller's group_staff.role (this table's RLS,
-- like every table in this app, is the tenant/visibility boundary, not
-- the permission boundary — see lib/permissions.ts's established
-- convention, mirrored here by lib/groups/permissions.ts).
CREATE OR REPLACE FUNCTION my_active_member_group_ids()
RETURNS SETOF UUID AS $$
  SELECT gm.group_id FROM group_memberships gm
  WHERE gm.status = 'ACTIVE'
    AND (gm.business_id IN (SELECT my_business_ids()) OR gm.business_id IN (SELECT my_staff_business_ids()))
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS "business_groups_member" ON business_groups;
CREATE POLICY "business_groups_member" ON business_groups
  FOR ALL USING (id IN (SELECT my_group_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "group_regions_member" ON group_regions;
CREATE POLICY "group_regions_member" ON group_regions
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "group_staff_member" ON group_staff;
CREATE POLICY "group_staff_member" ON group_staff
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR user_id = auth_user_id() OR is_super_admin());

-- A business's own owner/staff must be able to see (and respond to) an
-- invite addressed to their business, even before they've accepted it —
-- so this policy is the union of "I'm in the group" and "this is my
-- business" (mirroring the exact my_business_ids()/my_staff_business_ids()
-- pattern), never "same group = access" on anything beyond this linkage
-- row itself.
DROP POLICY IF EXISTS "group_memberships_visible" ON group_memberships;
CREATE POLICY "group_memberships_visible" ON group_memberships
  FOR ALL USING (
    group_id IN (SELECT my_group_ids())
    OR business_id IN (SELECT my_business_ids())
    OR business_id IN (SELECT my_staff_business_ids())
    OR is_super_admin()
  );

-- ----------------------------------------------------------------------------
-- M21-M30 — shared menu templates. TEMPLATE vs LIVE menu stay structurally
-- distinct (M23): a template item is never a menu_items row itself. Price
-- policy is per-item (M25/M57): REQUIRED (business must adopt the price),
-- RECOMMENDED (shown as a suggestion only), BUSINESS_CONTROLLED (business
-- sets their own, template value is informational only).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_menu_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  policy      TEXT NOT NULL DEFAULT 'GROUP_DEFAULT_BUSINESS_CAN_OVERRIDE' CHECK (policy IN ('GROUP_LOCKED', 'GROUP_DEFAULT_BUSINESS_CAN_OVERRIDE', 'BUSINESS_CONTROLLED')),
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_menu_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS group_menu_template_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID NOT NULL REFERENCES group_menu_templates(id) ON DELETE CASCADE,
  category          TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  allergens         TEXT[],
  recommended_price NUMERIC(10,2),
  price_policy      TEXT NOT NULL DEFAULT 'BUSINESS_CONTROLLED' CHECK (price_policy IN ('REQUIRED', 'RECOMMENDED', 'BUSINESS_CONTROLLED')),
  image_url         TEXT,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_menu_template_items ENABLE ROW LEVEL SECURITY;

-- M84 — versioning. Publishing a template snapshots it; a business always
-- knows which version it's currently applying and which (if any) newer
-- version is pending review — never silently rebased onto a newer
-- version's content.
CREATE TABLE IF NOT EXISTS group_menu_template_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES group_menu_templates(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  snapshot      JSONB NOT NULL, -- the full item list at publish time
  published_by  UUID REFERENCES users(id),
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);
ALTER TABLE group_menu_template_versions ENABLE ROW LEVEL SECURITY;

-- M22/M56 — the central change workflow itself: propose -> affected
-- businesses -> impact preview (computed in the app layer from this row's
-- own data, never stored) -> authorised application. A row here is the
-- ONLY thing that can ever cause a business's live menu_items to change
-- from a template — never a direct, automatic write.
CREATE TABLE IF NOT EXISTS group_menu_template_applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES group_menu_templates(id) ON DELETE CASCADE,
  version_id    UUID REFERENCES group_menu_template_versions(id) ON DELETE SET NULL,
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPLIED', 'REJECTED', 'SUPERSEDED')),
  proposed_by   UUID REFERENCES users(id),
  proposed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by    UUID REFERENCES users(id),
  applied_at    TIMESTAMPTZ,
  result        JSONB -- { items_created, items_updated, items_skipped_local_edit }
);
CREATE INDEX IF NOT EXISTS idx_group_menu_template_applications_business ON group_menu_template_applications(business_id, status);
ALTER TABLE group_menu_template_applications ENABLE ROW LEVEL SECURITY;

-- Links a live menu_items row back to the template item it was created
-- from, so a future re-apply can tell "this was never touched locally"
-- apart from "the business already customised this" (M23: local
-- price/availability/items preserved unless the template's own policy
-- says otherwise) — nullable, never populated for an item the business
-- created itself.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS group_template_item_id UUID REFERENCES group_menu_template_items(id) ON DELETE SET NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS group_template_version_applied INT;

DROP POLICY IF EXISTS "group_menu_templates_member" ON group_menu_templates;
CREATE POLICY "group_menu_templates_member" ON group_menu_templates
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR group_id IN (SELECT my_active_member_group_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "group_menu_template_items_member" ON group_menu_template_items;
CREATE POLICY "group_menu_template_items_member" ON group_menu_template_items
  FOR ALL USING (template_id IN (SELECT id FROM group_menu_templates WHERE group_id IN (SELECT my_group_ids()) OR group_id IN (SELECT my_active_member_group_ids())) OR is_super_admin());
DROP POLICY IF EXISTS "group_menu_template_versions_member" ON group_menu_template_versions;
CREATE POLICY "group_menu_template_versions_member" ON group_menu_template_versions
  FOR ALL USING (template_id IN (SELECT id FROM group_menu_templates WHERE group_id IN (SELECT my_group_ids()) OR group_id IN (SELECT my_active_member_group_ids())) OR is_super_admin());
-- A member business must see (and act on) applications addressed to IT,
-- even though it isn't itself "in the group" at the group_staff level.
DROP POLICY IF EXISTS "group_menu_template_applications_visible" ON group_menu_template_applications;
CREATE POLICY "group_menu_template_applications_visible" ON group_menu_template_applications
  FOR ALL USING (
    template_id IN (SELECT id FROM group_menu_templates WHERE group_id IN (SELECT my_group_ids()))
    OR business_id IN (SELECT my_business_ids())
    OR business_id IN (SELECT my_staff_business_ids())
    OR is_super_admin()
  );

-- The "impact preview" step (M22) needs a business to see the OTHER
-- member businesses' applications for the same template only as an
-- aggregate count in the app layer, never their content — so no further
-- policy is needed here; the API route computes that count server-side
-- from its own authorised group_staff context, not by relying on this
-- table's RLS to expose other businesses' rows to a business caller.

-- ----------------------------------------------------------------------------
-- M29-M30 — group preferred-supplier directory (names/categories only —
-- account numbers/pricing/contact stay in the existing, business-private
-- `supplier_records` table, untouched) and draft/bulk purchasing
-- proposals. A proposal NEVER creates a real purchase_orders row itself
-- (M30/M118: "do NOT automatically place supplier orders or create
-- liabilities") — a business converts a line into their own real PO
-- through the existing, unmodified purchase-order flow.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_preferred_suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT,
  notes       TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_preferred_suppliers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS group_purchase_proposals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROPOSED', 'CLOSED')),
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_purchase_proposals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS group_purchase_proposal_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id    UUID NOT NULL REFERENCES group_purchase_proposals(id) ON DELETE CASCADE,
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stock_item_name TEXT NOT NULL,
  quantity       NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  notes          TEXT,
  converted_to_po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_purchase_proposal_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_preferred_suppliers_member" ON group_preferred_suppliers;
CREATE POLICY "group_preferred_suppliers_member" ON group_preferred_suppliers
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR group_id IN (SELECT my_active_member_group_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "group_purchase_proposals_member" ON group_purchase_proposals;
CREATE POLICY "group_purchase_proposals_member" ON group_purchase_proposals
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR group_id IN (SELECT my_active_member_group_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "group_purchase_proposal_items_visible" ON group_purchase_proposal_items;
CREATE POLICY "group_purchase_proposal_items_visible" ON group_purchase_proposal_items
  FOR ALL USING (
    proposal_id IN (SELECT id FROM group_purchase_proposals WHERE group_id IN (SELECT my_group_ids()))
    OR business_id IN (SELECT my_business_ids())
    OR business_id IN (SELECT my_staff_business_ids())
    OR is_super_admin()
  );

-- ----------------------------------------------------------------------------
-- M31-M35 — group documents vs business-private documents, and group
-- memory (AI-retrievable text) kept as a genuinely SEPARATE store from
-- Phase F's `business_memory` (which has a NOT NULL business_id and is
-- explicitly business-private) — never a shared table with a nullable
-- column, so there is no code path that could accidentally leak one into
-- the other. No file-upload/storage infrastructure exists anywhere in
-- apps/web today (confirmed by audit) — `url` is an external link
-- (a PDF/Drive/Docs URL the group already hosts), consistent with how
-- `businesses.logo_url`/`van.profile_image_url` already work, rather than
-- introducing new Supabase Storage bucket infrastructure for this phase.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'OTHER' CHECK (category IN ('MANUAL', 'SOP', 'TRAINING', 'SUPPLIER_LIST', 'MENU_STANDARD', 'OTHER')),
  url            TEXT NOT NULL,
  visibility     TEXT NOT NULL DEFAULT 'ALL' CHECK (visibility IN ('ALL', 'REGION', 'SELECTED')),
  region_id      UUID REFERENCES group_regions(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS group_document_targets (
  document_id UUID NOT NULL REFERENCES group_documents(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, business_id)
);
ALTER TABLE group_document_targets ENABLE ROW LEVEL SECURITY;

-- M67/M73 — optional viewed/acknowledged tracking. Deliberately named
-- "acknowledged" not "certified"/"completed" anywhere in the app layer —
-- this table only ever proves someone opened/ack'd a link, never a
-- competency or compliance fact.
CREATE TABLE IF NOT EXISTS group_document_acknowledgements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES group_documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);
ALTER TABLE group_document_acknowledgements ENABLE ROW LEVEL SECURITY;

-- M65/M70 — GROUP memory, distinct from BUSINESS memory. Same embedding
-- shape as `business_memory` (Phase F) so lib/memory/* helpers can be
-- reused for the embedding/search mechanics, but a genuinely separate
-- table/RLS scope — the AI's group-memory tool and business-memory tool
-- are two different functions querying two different tables, so neither
-- can ever leak into the other's results even by a coding mistake in one
-- shared query.
CREATE TABLE IF NOT EXISTS group_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),
  category        TEXT,
  title           TEXT,
  content         TEXT NOT NULL,
  embedding       VECTOR(512),
  embedding_model TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_memory ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION match_group_memory(p_group_id UUID, p_query_embedding VECTOR(512), p_limit INT DEFAULT 5)
RETURNS TABLE (id UUID, title TEXT, content TEXT, category TEXT, similarity FLOAT) AS $$
  SELECT id, title, content, category, 1 - (embedding <=> p_query_embedding) AS similarity
  FROM group_memory
  WHERE group_id = p_group_id AND embedding IS NOT NULL
  ORDER BY embedding <=> p_query_embedding
  LIMIT p_limit
$$ LANGUAGE sql STABLE;

-- M31-M35 — internal announcements. Kept entirely separate from customer
-- marketing (Phase I `campaigns`) — this is staff-facing only. Delivery
-- FANS OUT into the existing, unmodified `notifications` table (one row
-- per targeted user) so it shows up in the same NotificationCentre every
-- other alert already uses, rather than a parallel inbox — `data->>'kind'
-- = 'group_announcement'` distinguishes it there.
CREATE TABLE IF NOT EXISTS group_announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  target_scope  TEXT NOT NULL DEFAULT 'ALL' CHECK (target_scope IN ('ALL', 'REGION', 'SELECTED')),
  region_id     UUID REFERENCES group_regions(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES users(id),
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_announcements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS group_announcement_targets (
  announcement_id UUID NOT NULL REFERENCES group_announcements(id) ON DELETE CASCADE,
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, business_id)
);
ALTER TABLE group_announcement_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_documents_visible" ON group_documents;
CREATE POLICY "group_documents_visible" ON group_documents
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR group_id IN (SELECT my_active_member_group_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "group_document_targets_visible" ON group_document_targets;
CREATE POLICY "group_document_targets_visible" ON group_document_targets
  FOR ALL USING (
    document_id IN (SELECT id FROM group_documents WHERE group_id IN (SELECT my_group_ids()))
    OR business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids())
    OR is_super_admin()
  );
DROP POLICY IF EXISTS "group_document_acknowledgements_own" ON group_document_acknowledgements;
CREATE POLICY "group_document_acknowledgements_own" ON group_document_acknowledgements
  FOR ALL USING (
    user_id = auth_user_id()
    OR document_id IN (SELECT id FROM group_documents WHERE group_id IN (SELECT my_group_ids()))
    OR is_super_admin()
  );
DROP POLICY IF EXISTS "group_memory_member" ON group_memory;
CREATE POLICY "group_memory_member" ON group_memory
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "group_announcements_visible" ON group_announcements;
CREATE POLICY "group_announcements_visible" ON group_announcements
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR group_id IN (SELECT my_active_member_group_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "group_announcement_targets_visible" ON group_announcement_targets;
CREATE POLICY "group_announcement_targets_visible" ON group_announcement_targets
  FOR ALL USING (
    announcement_id IN (SELECT id FROM group_announcements WHERE group_id IN (SELECT my_group_ids()))
    OR business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids())
    OR is_super_admin()
  );

-- ----------------------------------------------------------------------------
-- M36 — tag an event as group-sourced (participation stays explicit via
-- the EXISTING, unmodified event_applications flow per business — this
-- column is provenance only, never an auto-apply).
-- ----------------------------------------------------------------------------
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES business_groups(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- M54-M59 — inter-business stock transfers. A two-sided, auditable
-- workflow: A proposes -> B accepts -> real stock movements on BOTH sides
-- via the existing, unmodified apply_stock_movement() RPC (Phase C) —
-- never a silent cross-business quantity edit. `to_stock_item_id` is
-- resolved (and required) only at acceptance time, by business B matching
-- their own stock catalogue — this migration never invents or auto-creates
-- a stock item on B's behalf.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_stock_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  from_business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  to_business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  from_stock_item_id  UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  to_stock_item_id    UUID REFERENCES stock_items(id) ON DELETE SET NULL,
  quantity            NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  status              TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED')),
  notes               TEXT,
  proposed_by         UUID REFERENCES users(id),
  responded_by        UUID REFERENCES users(id),
  idempotency_key     TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  CHECK (from_business_id <> to_business_id)
);
CREATE INDEX IF NOT EXISTS idx_group_stock_transfers_business ON group_stock_transfers(from_business_id, to_business_id);
ALTER TABLE group_stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_stock_transfers_visible" ON group_stock_transfers;
CREATE POLICY "group_stock_transfers_visible" ON group_stock_transfers
  FOR ALL USING (
    from_business_id IN (SELECT my_business_ids()) OR from_business_id IN (SELECT my_staff_business_ids())
    OR to_business_id IN (SELECT my_business_ids()) OR to_business_id IN (SELECT my_staff_business_ids())
    OR group_id IN (SELECT my_group_ids())
    OR is_super_admin()
  );

-- ----------------------------------------------------------------------------
-- M99 — optional group goals, same shape as Phase K's business_goals
-- (never a punitive ranking — a target, nothing more).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  goal_type     TEXT NOT NULL CHECK (goal_type IN ('revenue', 'wastage_ceiling_pct', 'hygiene_completion_pct', 'repeat_customer_rate_pct')),
  period        TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly')),
  target_value  NUMERIC(12,2) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_goals_member" ON group_goals;
CREATE POLICY "group_goals_member" ON group_goals
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR group_id IN (SELECT my_active_member_group_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- M48-M53 — group marketing proposals. A proposal is only ever a shared
-- DRAFT — each participating business resolves its OWN audience from its
-- OWN CRM/consent (never a shared/merged customer list) and sends through
-- the EXISTING, unmodified campaign confirm flow (app/api/crm/campaigns/
-- [id]/confirm) — this table never sends anything itself, and never
-- stores a customer list.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_campaign_proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  message_draft TEXT,
  status       TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROPOSED', 'CLOSED')),
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE group_campaign_proposals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS group_campaign_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID NOT NULL REFERENCES group_campaign_proposals(id) ON DELETE CASCADE,
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DECLINED', 'CAMPAIGN_CREATED')),
  campaign_id  UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  UNIQUE (proposal_id, business_id)
);
ALTER TABLE group_campaign_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_campaign_proposals_member" ON group_campaign_proposals;
CREATE POLICY "group_campaign_proposals_member" ON group_campaign_proposals
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR group_id IN (SELECT my_active_member_group_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "group_campaign_participants_visible" ON group_campaign_participants;
CREATE POLICY "group_campaign_participants_visible" ON group_campaign_participants
  FOR ALL USING (
    proposal_id IN (SELECT id FROM group_campaign_proposals WHERE group_id IN (SELECT my_group_ids()))
    OR business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids())
    OR is_super_admin()
  );

-- ----------------------------------------------------------------------------
-- M77-M84 — generic bulk-operation tracking, reused by every bulk action
-- in this phase (template apply, announcement send, price-policy push).
-- `idempotency_key` makes a retried trigger a no-op, not a re-run;
-- per-business results always show succeeded/failed/skipped/reason (M78).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_bulk_operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES business_groups(id) ON DELETE CASCADE,
  operation_type  TEXT NOT NULL CHECK (operation_type IN ('APPLY_MENU_TEMPLATE', 'SEND_ANNOUNCEMENT', 'PUSH_PRICE_POLICY')),
  reference_id    UUID, -- the template/announcement id this bulk run is for
  status          TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED')),
  initiated_by    UUID REFERENCES users(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
ALTER TABLE group_bulk_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_bulk_operations_member" ON group_bulk_operations;
CREATE POLICY "group_bulk_operations_member" ON group_bulk_operations
  FOR ALL USING (group_id IN (SELECT my_group_ids()) OR is_super_admin());

CREATE TABLE IF NOT EXISTS group_bulk_operation_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES group_bulk_operations(id) ON DELETE CASCADE,
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('SUCCEEDED', 'FAILED', 'SKIPPED')),
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (operation_id, business_id)
);
ALTER TABLE group_bulk_operation_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_bulk_operation_results_visible" ON group_bulk_operation_results;
CREATE POLICY "group_bulk_operation_results_visible" ON group_bulk_operation_results
  FOR ALL USING (
    operation_id IN (SELECT id FROM group_bulk_operations WHERE group_id IN (SELECT my_group_ids()))
    OR business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids())
    OR is_super_admin()
  );
