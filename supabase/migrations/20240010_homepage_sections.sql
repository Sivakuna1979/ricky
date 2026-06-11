-- Homepage sections table for admin-controlled homepage layout

create table if not exists homepage_sections (
  key text primary key,
  title text not null,
  position integer not null,
  visible boolean not null default true,
  updated_at timestamptz default now()
);

-- Enable RLS
alter table homepage_sections enable row level security;

-- Drop existing policies if any
drop policy if exists "Allow all" on homepage_sections;
drop policy if exists "admin_select" on homepage_sections;
drop policy if exists "admin_insert" on homepage_sections;
drop policy if exists "admin_update" on homepage_sections;
drop policy if exists "admin_delete" on homepage_sections;

-- Public read (homepage needs to read sections)
create policy "public_select" on homepage_sections
  for select using (true);

-- Service role / authenticated can write (admin only)
create policy "admin_insert" on homepage_sections
  for insert with check (true);

create policy "admin_update" on homepage_sections
  for update using (true) with check (true);

create policy "admin_delete" on homepage_sections
  for delete using (true);

-- Seed default sections
insert into homepage_sections (key, title, position, visible) values
  ('hero',              'Hero Banner',         1,  true),
  ('stats',             'Stats Bar',           2,  true),
  ('food_categories',   'Food Categories',     3,  true),
  ('google_businesses', 'Local Businesses',    4,  true),
  ('featured_vans',     'Featured Vans',       5,  true),
  ('event_booking',     'Event Booking',       6,  true),
  ('testimonials',      'Testimonials',        7,  true),
  ('footer',            'Footer',              8,  true)
on conflict (key) do nothing;

-- Auto-update updated_at
create or replace function update_homepage_sections_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists homepage_sections_updated_at on homepage_sections;
create trigger homepage_sections_updated_at
  before update on homepage_sections
  for each row execute function update_homepage_sections_updated_at();

-- Grant anon read access (for homepage to read sections)
grant select on homepage_sections to anon;
grant all on homepage_sections to authenticated;
grant all on homepage_sections to service_role;
