-- ============================================================
-- Automated YouTube Channel Platform — Core Schema
-- All tables are prefixed yt_ to avoid collisions with the
-- Food Taxi / AgentHub schemas that already live in this project.
-- Ownership model: every row traces back (directly or via a
-- parent FK) to yt_channels.user_id = auth.uid().
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Profile-level settings (one per app user)
-- ------------------------------------------------------------
create table if not exists yt_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  notification_email text,
  daily_spend_limit_usd numeric(10,2) not null default 10.00,
  monthly_spend_limit_usd numeric(10,2) not null default 150.00,
  is_paused boolean not null default false,
  paused_at timestamptz,
  paused_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Encrypted, user-supplied provider credentials
-- ------------------------------------------------------------
create table if not exists yt_api_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_type text not null check (provider_type in (
    'script_ai','research','tts','image_gen','stock_video','stock_image',
    'music','youtube_oauth','email','moderation'
  )),
  provider_name text not null,
  encrypted_payload text not null,
  iv text not null,
  auth_tag text not null,
  is_active boolean not null default true,
  last_validated_at timestamptz,
  last_validation_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_type, provider_name)
);

-- ------------------------------------------------------------
-- YouTube channels connected via OAuth
-- ------------------------------------------------------------
create table if not exists yt_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  youtube_channel_id text not null,
  title text not null,
  thumbnail_url text,
  oauth_access_token_encrypted text not null,
  oauth_access_token_iv text not null,
  oauth_access_token_tag text not null,
  oauth_refresh_token_encrypted text not null,
  oauth_refresh_token_iv text not null,
  oauth_refresh_token_tag text not null,
  oauth_token_expires_at timestamptz not null,
  granted_scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active','disconnected','error')),
  is_paused boolean not null default false,
  paused_at timestamptz,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, youtube_channel_id)
);

-- ------------------------------------------------------------
-- Niches (candidate + selected)
-- ------------------------------------------------------------
create table if not exists yt_niches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  search_demand_score numeric(4,1) check (search_demand_score between 0 and 10),
  competition_score numeric(4,1) check (competition_score between 0 and 10),
  advertiser_suitability_score numeric(4,1) check (advertiser_suitability_score between 0 and 10),
  production_difficulty_score numeric(4,1) check (production_difficulty_score between 0 and 10),
  evergreen_score numeric(4,1) check (evergreen_score between 0 and 10),
  originality_potential_score numeric(4,1) check (originality_potential_score between 0 and 10),
  copyright_risk_score numeric(4,1) check (copyright_risk_score between 0 and 10),
  retention_potential_score numeric(4,1) check (retention_potential_score between 0 and 10),
  uk_intl_potential_score numeric(4,1) check (uk_intl_potential_score between 0 and 10),
  overall_score numeric(5,2),
  is_sensitive boolean not null default false,
  sensitive_category text check (sensitive_category in (
    'medical','legal','financial','political','tragic_event','celebrity_rumour','childrens_content', null
  )),
  safeguards_acknowledged boolean not null default false,
  safeguards_notes text,
  status text not null default 'candidate' check (status in ('candidate','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Per-channel content & automation settings
-- ------------------------------------------------------------
create table if not exists yt_channel_settings (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null unique references yt_channels(id) on delete cascade,
  niche_id uuid references yt_niches(id) on delete set null,
  upload_pattern text not null default 'short_and_long' check (upload_pattern in (
    'two_shorts','short_and_long','two_long','custom'
  )),
  custom_schedule jsonb not null default '[]',
  approval_mode text not null default 'assisted' check (approval_mode in ('manual','assisted','full_auto')),
  production_mode text not null default 'standard' check (production_mode in ('low_cost','standard','premium')),
  video_style_prefs jsonb not null default '{}',
  allowed_video_types text[] not null default array[
    'explainer','list','educational','story','product_comparison','news'
  ],
  timezone text not null default 'Europe/London',
  slot_time_1 time not null default '09:00',
  slot_time_2 time not null default '17:00',
  ai_disclosure_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Topics
-- ------------------------------------------------------------
create table if not exists yt_topics (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references yt_channels(id) on delete cascade,
  niche_id uuid references yt_niches(id) on delete set null,
  schedule_id uuid,
  title text not null,
  angle text,
  video_type text not null check (video_type in (
    'explainer','list','educational','story','product_comparison','news'
  )),
  format text not null check (format in ('short','long')),
  target_keywords text[] not null default '{}',
  score numeric(5,2),
  score_breakdown jsonb not null default '{}',
  dedup_hash text not null,
  is_sensitive_topic boolean not null default false,
  status text not null default 'proposed' check (status in (
    'proposed','approved','rejected','in_production','used','archived'
  )),
  rejected_reason text,
  source text not null default 'ai_generated' check (source in ('ai_generated','manual','trend')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_yt_topics_channel on yt_topics(channel_id);
create index if not exists idx_yt_topics_dedup_hash on yt_topics(channel_id, dedup_hash);

-- ------------------------------------------------------------
-- Research sources (for factual-claim provenance)
-- ------------------------------------------------------------
create table if not exists yt_research_sources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references yt_topics(id) on delete cascade,
  url text not null,
  title text,
  publisher text,
  published_at date,
  retrieved_at timestamptz not null default now(),
  reliability_score numeric(3,1) check (reliability_score between 0 and 10),
  summary text,
  supports_claims text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_yt_research_sources_topic on yt_research_sources(topic_id);

-- ------------------------------------------------------------
-- Scripts
-- ------------------------------------------------------------
create table if not exists yt_scripts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references yt_topics(id) on delete cascade,
  version int not null default 1,
  content text not null,
  hook text not null,
  structure jsonb not null default '[]',
  word_count int not null default 0,
  estimated_duration_seconds int not null default 0,
  originality_score numeric(4,1) check (originality_score between 0 and 10),
  plagiarism_report jsonb not null default '{}',
  quality_score numeric(4,1) check (quality_score between 0 and 10),
  quality_feedback jsonb not null default '{}',
  hook_repetition_flag boolean not null default false,
  ai_disclosure_required boolean not null default true,
  status text not null default 'draft' check (status in (
    'draft','needs_revision','approved','rejected'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_yt_scripts_topic on yt_scripts(topic_id);

-- ------------------------------------------------------------
-- Voice-overs
-- ------------------------------------------------------------
create table if not exists yt_voiceovers (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references yt_scripts(id) on delete cascade,
  provider text not null,
  voice_id text not null,
  storage_path text,
  duration_seconds numeric(8,2),
  word_timings jsonb not null default '[]',
  cost_usd numeric(10,4) not null default 0,
  status text not null default 'pending' check (status in ('pending','generating','ready','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_yt_voiceovers_script on yt_voiceovers(script_id);

-- ------------------------------------------------------------
-- Media assets (stock video/image, generated graphics, music, sfx, fonts)
-- ------------------------------------------------------------
create table if not exists yt_media_assets (
  id uuid primary key default gen_random_uuid(),
  video_id uuid,
  topic_id uuid references yt_topics(id) on delete set null,
  asset_type text not null check (asset_type in (
    'stock_video','stock_image','generated_image','generated_video','music','sfx','font'
  )),
  provider text not null,
  source_url text,
  storage_path text,
  license_type text not null,
  license_url text,
  attribution_required boolean not null default false,
  attribution_text text,
  checksum text,
  scene_index int,
  created_at timestamptz not null default now()
);
create index if not exists idx_yt_media_assets_video on yt_media_assets(video_id);

-- ------------------------------------------------------------
-- Videos (the rendered output + its metadata)
-- ------------------------------------------------------------
create table if not exists yt_videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references yt_channels(id) on delete cascade,
  topic_id uuid not null references yt_topics(id) on delete cascade,
  script_id uuid not null references yt_scripts(id) on delete cascade,
  voiceover_id uuid references yt_voiceovers(id) on delete set null,
  aspect_ratio text not null check (aspect_ratio in ('9:16','16:9')),
  video_kind text not null check (video_kind in ('short','long')),
  render_status text not null default 'pending' check (render_status in (
    'pending','planning','rendering','rendered','failed'
  )),
  storage_path text,
  duration_seconds numeric(8,2),
  resolution text,
  subtitles_path text,
  subtitle_language text not null default 'en',
  ai_disclosure_applied boolean not null default true,
  quality_score numeric(4,1) check (quality_score between 0 and 10),
  quality_report jsonb not null default '{}',
  duplicate_check jsonb not null default '{}',
  production_mode text not null default 'standard' check (production_mode in ('low_cost','standard','premium')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_yt_videos_channel on yt_videos(channel_id);
create index if not exists idx_yt_videos_topic on yt_videos(topic_id);

alter table yt_media_assets
  add constraint yt_media_assets_video_fk foreign key (video_id) references yt_videos(id) on delete cascade;

-- ------------------------------------------------------------
-- Video metadata (title/description/tags/chapters/pinned comment)
-- ------------------------------------------------------------
create table if not exists yt_video_metadata (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null unique references yt_videos(id) on delete cascade,
  title text not null,
  description text not null,
  tags text[] not null default '{}',
  hashtags text[] not null default '{}',
  chapters jsonb not null default '[]',
  pinned_comment text,
  category_id text not null default '27',
  made_for_kids boolean not null default false,
  contains_synthetic_media boolean not null default false,
  language text not null default 'en',
  misleading_check_passed boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Thumbnails
-- ------------------------------------------------------------
create table if not exists yt_thumbnails (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references yt_videos(id) on delete cascade,
  storage_path text not null,
  variant text not null default 'A',
  is_selected boolean not null default false,
  deceptive_check_passed boolean,
  impersonation_check_passed boolean,
  source text not null default 'ai_generated',
  created_at timestamptz not null default now()
);
create index if not exists idx_yt_thumbnails_video on yt_thumbnails(video_id);

-- ------------------------------------------------------------
-- Schedules (production calendar slots)
-- ------------------------------------------------------------
create table if not exists yt_schedules (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references yt_channels(id) on delete cascade,
  slot_date date not null,
  slot_time time not null,
  video_kind text not null check (video_kind in ('short','long')),
  status text not null default 'planned' check (status in ('planned','filled','skipped','failed')),
  video_id uuid references yt_videos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, slot_date, slot_time)
);
create index if not exists idx_yt_schedules_channel_date on yt_schedules(channel_id, slot_date);

alter table yt_topics
  add constraint yt_topics_schedule_fk foreign key (schedule_id) references yt_schedules(id) on delete set null;
create index if not exists idx_yt_topics_schedule on yt_topics(schedule_id);

-- ------------------------------------------------------------
-- Uploads (YouTube upload lifecycle)
-- ------------------------------------------------------------
create table if not exists yt_uploads (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references yt_videos(id) on delete cascade,
  channel_id uuid not null references yt_channels(id) on delete cascade,
  schedule_id uuid references yt_schedules(id) on delete set null,
  youtube_video_id text,
  upload_status text not null default 'pending' check (upload_status in (
    'pending','uploading','uploaded','scheduled','published','failed'
  )),
  privacy_status text not null default 'private' check (privacy_status in ('private','unlisted','public')),
  publish_at timestamptz,
  processing_status text,
  error_message text,
  retry_count int not null default 0,
  uploaded_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_yt_uploads_channel on yt_uploads(channel_id);
create index if not exists idx_yt_uploads_video on yt_uploads(video_id);

-- ------------------------------------------------------------
-- Playlists
-- ------------------------------------------------------------
create table if not exists yt_playlists (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references yt_channels(id) on delete cascade,
  youtube_playlist_id text,
  title text not null,
  description text,
  match_video_kind text check (match_video_kind in ('short','long', null)),
  match_niche_id uuid references yt_niches(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists yt_playlist_videos (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references yt_playlists(id) on delete cascade,
  video_id uuid not null references yt_videos(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (playlist_id, video_id)
);

-- ------------------------------------------------------------
-- Analytics
-- ------------------------------------------------------------
create table if not exists yt_analytics (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references yt_videos(id) on delete cascade,
  upload_id uuid references yt_uploads(id) on delete set null,
  metric_date date not null,
  views int not null default 0,
  impressions int not null default 0,
  ctr numeric(6,4),
  avg_view_duration_seconds numeric(8,2),
  avg_view_percentage numeric(6,2),
  likes int not null default 0,
  comments int not null default 0,
  subscribers_gained int not null default 0,
  shares int not null default 0,
  traffic_sources jsonb not null default '{}',
  shorts_swipe_data jsonb not null default '{}',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (video_id, metric_date)
);
create index if not exists idx_yt_analytics_video on yt_analytics(video_id);

-- ------------------------------------------------------------
-- Generation costs
-- ------------------------------------------------------------
create table if not exists yt_generation_costs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references yt_channels(id) on delete cascade,
  video_id uuid references yt_videos(id) on delete set null,
  topic_id uuid references yt_topics(id) on delete set null,
  stage text not null check (stage in (
    'research','script','voiceover','image_gen','stock_media','render','thumbnail','moderation','other'
  )),
  provider text not null,
  estimated_cost_usd numeric(10,4) not null default 0,
  actual_cost_usd numeric(10,4),
  currency text not null default 'USD',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_yt_generation_costs_channel on yt_generation_costs(channel_id, created_at);

-- ------------------------------------------------------------
-- Approvals (topic / script / video / thumbnail gate)
-- ------------------------------------------------------------
create table if not exists yt_approvals (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references yt_channels(id) on delete cascade,
  entity_type text not null check (entity_type in ('topic','script','video','thumbnail')),
  entity_id uuid not null,
  status text not null default 'pending' check (status in (
    'pending','approved','rejected','changes_requested'
  )),
  decided_by uuid references auth.users(id),
  notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_yt_approvals_entity on yt_approvals(entity_type, entity_id);
create index if not exists idx_yt_approvals_channel on yt_approvals(channel_id, status);

-- ------------------------------------------------------------
-- Policy checks (Community Guidelines / advertiser-friendly / AI disclosure)
-- ------------------------------------------------------------
create table if not exists yt_policy_checks (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references yt_videos(id) on delete cascade,
  check_type text not null,
  passed boolean not null,
  severity text not null default 'info' check (severity in ('info','warning','blocking')),
  details jsonb not null default '{}',
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_yt_policy_checks_video on yt_policy_checks(video_id);

-- ------------------------------------------------------------
-- Copyright / originality checks
-- ------------------------------------------------------------
create table if not exists yt_copyright_checks (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references yt_videos(id) on delete cascade,
  asset_id uuid references yt_media_assets(id) on delete set null,
  check_type text not null,
  passed boolean not null,
  details jsonb not null default '{}',
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_yt_copyright_checks_video on yt_copyright_checks(video_id);

-- ------------------------------------------------------------
-- Job logs (background pipeline execution history)
-- ------------------------------------------------------------
create table if not exists yt_job_logs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references yt_channels(id) on delete cascade,
  video_id uuid references yt_videos(id) on delete set null,
  topic_id uuid references yt_topics(id) on delete set null,
  job_name text not null,
  queue text not null,
  status text not null default 'queued' check (status in (
    'queued','running','completed','failed','retrying'
  )),
  attempt int not null default 1,
  error_message text,
  payload jsonb not null default '{}',
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index if not exists idx_yt_job_logs_channel on yt_job_logs(channel_id, created_at desc);

-- ------------------------------------------------------------
-- Notifications
-- ------------------------------------------------------------
create table if not exists yt_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'approval_required','video_scheduled','video_published','upload_failed',
    'render_failed','copyright_warning','policy_warning','api_limit_reached',
    'spend_limit_reached'
  )),
  title text not null,
  body text not null,
  related_entity jsonb not null default '{}',
  is_read boolean not null default false,
  sent_via text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_yt_notifications_user on yt_notifications(user_id, is_read);
