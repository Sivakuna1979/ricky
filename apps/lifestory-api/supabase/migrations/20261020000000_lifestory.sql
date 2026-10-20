-- Life Story Films. Tables are prefixed ls_ so they can share a Supabase project with the other apps.
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

create table if not exists public.ls_films (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_name text not null,
  relation text,                         -- "my grandmother", "our father"
  occasion text not null default 'celebration'
    check (occasion in ('birthday', 'anniversary', 'memorial', 'wedding', 'retirement', 'celebration')),
  language text not null default 'en',   -- narration language (BCP-47, e.g. en, ta, hi)
  voice text not null default 'warm_female',
  format text not null default 'landscape' check (format in ('landscape', 'portrait')),
  status text not null default 'draft'
    check (status in ('draft', 'scripted', 'queued', 'rendering', 'ready', 'failed')),
  interview jsonb not null default '[]'::jsonb, -- [{ role: 'assistant' | 'user', content }]
  script jsonb,
  progress real not null default 0,
  video_path text,
  poster_path text,
  duration_seconds real,
  error text,
  purchase_id text unique,               -- the store transaction that paid for this film
  script_attempts int not null default 0, -- caps free rewrites (each one costs a Claude call)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_photos (
  id uuid primary key default gen_random_uuid(),
  film_id uuid not null references public.ls_films (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null,
  position int not null default 0,
  note text,                             -- optional: "Dad's first car, 1975"
  created_at timestamptz not null default now()
);
create index if not exists ls_photos_film_idx on public.ls_photos (film_id, position);

create table if not exists public.ls_devices (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expo_push_token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_push_token)
);

create or replace function public.ls_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists ls_films_touch on public.ls_films;
create trigger ls_films_touch before update on public.ls_films for each row execute function public.ls_touch();

-- Row level security: people see and create only their own things. Everything that changes a
-- film after creation (interview, script, payment, rendering) goes through the API with the service role.
alter table public.ls_films enable row level security;
alter table public.ls_photos enable row level security;
alter table public.ls_devices enable row level security;

drop policy if exists ls_films_select on public.ls_films;
create policy ls_films_select on public.ls_films for select using (user_id = auth.uid());
drop policy if exists ls_films_insert on public.ls_films;
create policy ls_films_insert on public.ls_films for insert with check (user_id = auth.uid() and status = 'draft' and purchase_id is null);
drop policy if exists ls_films_delete on public.ls_films;
create policy ls_films_delete on public.ls_films for delete using (user_id = auth.uid() and status <> 'rendering');

drop policy if exists ls_photos_all on public.ls_photos;
create policy ls_photos_all on public.ls_photos for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.ls_films f where f.id = film_id and f.user_id = auth.uid() and f.status in ('draft', 'scripted')));

drop policy if exists ls_devices_all on public.ls_devices;
create policy ls_devices_all on public.ls_devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The render worker takes the oldest queued film; SKIP LOCKED lets several workers run safely.
create or replace function public.ls_claim_film() returns setof public.ls_films
language sql security definer set search_path = public as $$
  update public.ls_films set status = 'rendering', progress = 0, error = null
  where id = (
    select id from public.ls_films where status = 'queued'
    order by updated_at limit 1 for update skip locked
  )
  returning *;
$$;
revoke all on function public.ls_claim_film() from public, anon, authenticated;

-- Private storage: photos/<user id>/<film id>/... Only the owner can read or upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lifestory', 'lifestory', false, 314572800, array['image/jpeg', 'image/png', 'video/mp4'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ls_storage_read on storage.objects;
create policy ls_storage_read on storage.objects for select
  using (bucket_id = 'lifestory' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists ls_storage_write on storage.objects;
create policy ls_storage_write on storage.objects for insert
  with check (bucket_id = 'lifestory' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists ls_storage_delete on storage.objects;
create policy ls_storage_delete on storage.objects for delete
  using (bucket_id = 'lifestory' and (storage.foldername(name))[1] = auth.uid()::text);
