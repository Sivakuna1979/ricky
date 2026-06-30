-- ============================================================
-- Multi-tenant WhatsApp / Telegram AI Agent Platform
-- ============================================================
-- Each customer (workspace) gets AI agents, connected channels
-- (WhatsApp / Telegram), conversations, a knowledge base,
-- scheduled jobs and third-party integrations. Row Level
-- Security scopes every row to the members of its workspace.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- Workspaces (tenants) ----------------------------
create table if not exists public.workspaces (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  owner_id              uuid not null references auth.users(id) on delete cascade,
  plan                  text not null default 'free',          -- free | starter | pro | business
  subscription_status   text not null default 'inactive',      -- inactive | trialing | active | past_due | canceled
  stripe_customer_id    text,
  stripe_subscription_id text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member',                 -- owner | admin | member
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ---------- AI Agents ---------------------------------------
create table if not exists public.agents (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  system_prompt text not null default 'You are a helpful assistant.',
  model         text not null default 'claude-opus-4-8',
  temperature   numeric not null default 0.7,
  voice_enabled boolean not null default true,
  tools_enabled jsonb not null default '["web_search","image_generation","knowledge_base","reminders","google_workspace"]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- Channels (WhatsApp / Telegram) ------------------
create table if not exists public.channels (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id     uuid references public.agents(id) on delete set null,
  type         text not null,                                   -- whatsapp | telegram
  name         text not null,
  status       text not null default 'disconnected',            -- disconnected | connecting | connected | error
  external_id  text,                                            -- WA phone number id / Telegram bot id
  -- Per-channel credentials (bot token, WA access token, phone id, verify token).
  -- Stored as jsonb; treat as secret. Encrypt at rest in production.
  credentials  jsonb not null default '{}'::jsonb,
  -- Random token used to namespace inbound webhook URLs per channel.
  webhook_secret text not null default replace(uuid_generate_v4()::text, '-', ''),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists channels_webhook_secret_idx on public.channels(webhook_secret);
create index if not exists channels_external_id_idx on public.channels(type, external_id);

-- ---------- Contacts (end users messaging the agent) --------
create table if not exists public.contacts (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id   uuid not null references public.channels(id) on delete cascade,
  external_id  text not null,                                   -- WA phone / Telegram chat id
  name         text,
  phone        text,
  created_at   timestamptz not null default now(),
  unique (channel_id, external_id)
);

-- ---------- Conversations & Messages ------------------------
create table if not exists public.conversations (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  channel_id      uuid not null references public.channels(id) on delete cascade,
  agent_id        uuid references public.agents(id) on delete set null,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  status          text not null default 'open',                 -- open | closed
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists conversations_channel_contact_idx
  on public.conversations(channel_id, contact_id);

create table if not exists public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  role            text not null,                                -- user | assistant | system | tool
  content         text not null default '',
  media_url       text,
  media_type      text,                                         -- image | audio | document
  tokens          integer,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages(conversation_id, created_at);

-- 90-day conversation history retention helper (called by cron).
create or replace function public.purge_old_messages(retention_days integer default 90)
returns void language sql as $$
  delete from public.messages
  where created_at < now() - (retention_days || ' days')::interval;
$$;

-- ---------- Knowledge base ----------------------------------
create table if not exists public.knowledge_documents (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id     uuid references public.agents(id) on delete cascade,
  title        text not null,
  content      text not null,
  source       text,                                            -- upload | url | manual
  created_at   timestamptz not null default now(),
  -- Full text search vector for lightweight retrieval (no pgvector dependency).
  fts          tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''))) stored
);

create index if not exists knowledge_documents_fts_idx
  on public.knowledge_documents using gin(fts);

-- ---------- Scheduled jobs & reminders ----------------------
create table if not exists public.scheduled_jobs (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  agent_id      uuid references public.agents(id) on delete set null,
  channel_id    uuid references public.channels(id) on delete set null,
  recipient     text,                                           -- external id to deliver to
  name          text not null,
  prompt        text not null,                                  -- instruction the agent runs at fire time
  cron          text,                                           -- optional recurring cron expression
  run_at        timestamptz,                                    -- optional one-shot time
  next_run_at   timestamptz,
  status        text not null default 'scheduled',              -- scheduled | running | done | error | canceled
  last_run_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists scheduled_jobs_due_idx
  on public.scheduled_jobs(status, next_run_at);

-- ---------- Third party integrations (Google Workspace) -----
create table if not exists public.integrations (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  provider      text not null,                                  -- google
  access_token  text,
  refresh_token text,
  expiry        timestamptz,
  scopes        text,
  account_email text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, provider)
);

-- ---------- Usage metering (for plan limits) ----------------
create table if not exists public.usage_events (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind         text not null,                                   -- message | image | web_search | voice_minute
  quantity     integer not null default 1,
  created_at   timestamptz not null default now()
);

create index if not exists usage_events_workspace_idx
  on public.usage_events(workspace_id, created_at);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.agents            enable row level security;
alter table public.channels          enable row level security;
alter table public.contacts          enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.scheduled_jobs    enable row level security;
alter table public.integrations      enable row level security;
alter table public.usage_events      enable row level security;

-- Helper: is the current user a member of a workspace?
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- Workspaces: members can read; owner can update/delete; any authed user can create.
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select using (public.is_workspace_member(id) or owner_id = auth.uid());

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update using (owner_id = auth.uid());

-- Members
drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members
  for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

drop policy if exists members_insert on public.workspace_members;
create policy members_insert on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
  );

-- Generic workspace-scoped tables: members have full access.
do $$
declare t text;
begin
  foreach t in array array[
    'agents','channels','contacts','conversations','messages',
    'knowledge_documents','scheduled_jobs','integrations','usage_events'
  ] loop
    execute format('drop policy if exists %I_all on public.%I;', t, t);
    execute format(
      'create policy %I_all on public.%I for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- Auto-provision a workspace for every new user.
-- ============================================================
create or replace function public.handle_new_agent_user()
returns trigger language plpgsql security definer as $$
declare ws_id uuid;
begin
  insert into public.workspaces (name, owner_id)
  values (coalesce(new.raw_user_meta_data->>'workspace_name', 'My Workspace'), new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  insert into public.agents (workspace_id, name, system_prompt)
  values (ws_id, 'My First Agent',
    'You are a friendly, concise AI assistant that helps customers over chat. Be helpful and professional.');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_agent on auth.users;
create trigger on_auth_user_created_agent
  after insert on auth.users
  for each row execute function public.handle_new_agent_user();
