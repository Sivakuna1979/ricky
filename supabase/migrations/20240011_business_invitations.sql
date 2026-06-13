-- ============================================================================
-- Business Invitation & Claim System
-- ============================================================================

-- 1. Enhance discovered_businesses with all contact + invitation fields
alter table if exists discovered_businesses
  add column if not exists google_place_id   text,
  add column if not exists rating            numeric,
  add column if not exists total_ratings     integer,
  add column if not exists category          text,
  add column if not exists email             text,
  add column if not exists invitation_token  text,
  add column if not exists invitation_method text,
  add column if not exists opened_at         timestamptz,
  add column if not exists claimed_at        timestamptz,
  add column if not exists claimed_by        uuid,
  add column if not exists converted_business_id uuid,
  add column if not exists expires_at        timestamptz;

-- Unique index on google_place_id so upserts work
create unique index if not exists discovered_businesses_place_id_idx
  on discovered_businesses (google_place_id)
  where google_place_id is not null;

-- Unique index on invitation_token
create unique index if not exists discovered_businesses_token_idx
  on discovered_businesses (invitation_token)
  where invitation_token is not null;

-- Backfill tokens for any existing rows that lack one
update discovered_businesses
  set invitation_token = encode(gen_random_bytes(16), 'hex')
  where invitation_token is null;

-- ============================================================================
-- 2. business_invitations — full audit log of every invitation event
-- ============================================================================
create table if not exists business_invitations (
  id                uuid primary key default gen_random_uuid(),
  discovered_id     uuid references discovered_businesses(id) on delete cascade,
  google_place_id   text,
  business_name     text not null,
  phone             text,
  email             text,
  website           text,
  address           text,
  invitation_token  text not null,
  status            text not null default 'sent',  -- draft | sent | opened | claimed | expired
  method            text,                          -- whatsapp | sms | email | copied
  notes             text,
  sent_at           timestamptz default now(),
  opened_at         timestamptz,
  claimed_at        timestamptz,
  created_at        timestamptz default now()
);

create index if not exists business_invitations_status_idx on business_invitations (status);
create index if not exists business_invitations_token_idx  on business_invitations (invitation_token);

-- ============================================================================
-- 3. RLS — service role bypasses RLS; these are managed server-side only
-- ============================================================================
alter table business_invitations enable row level security;

-- Allow anyone to read a single invitation by token (for the public claim page)
drop policy if exists "public read invitation by token" on business_invitations;
create policy "public read invitation by token"
  on business_invitations for select
  using (true);
