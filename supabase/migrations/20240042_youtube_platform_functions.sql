-- ============================================================
-- Automated YouTube Channel Platform — Functions & Triggers
-- Reuses the shared set_updated_at() function defined in
-- 20240003_functions_triggers.sql.
-- ============================================================

create trigger set_updated_at_yt_profiles before update on yt_profiles
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_api_credentials before update on yt_api_credentials
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_channels before update on yt_channels
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_niches before update on yt_niches
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_channel_settings before update on yt_channel_settings
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_topics before update on yt_topics
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_scripts before update on yt_scripts
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_voiceovers before update on yt_voiceovers
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_videos before update on yt_videos
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_video_metadata before update on yt_video_metadata
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_schedules before update on yt_schedules
  for each row execute function set_updated_at();
create trigger set_updated_at_yt_uploads before update on yt_uploads
  for each row execute function set_updated_at();

-- Auto-create a yt_profiles row for every new auth user (mirrors the
-- pattern already used for the Food Taxi `users` table).
create or replace function yt_handle_new_user()
returns trigger as $$
begin
  insert into yt_profiles (id, display_name, notification_email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists yt_on_auth_user_created on auth.users;
create trigger yt_on_auth_user_created
  after insert on auth.users
  for each row execute function yt_handle_new_user();

-- Spend-limit helper: sum of actual (falling back to estimated) cost
-- for a channel's owner within a date range. Used by the worker before
-- starting a new production run, and exposed to the dashboard for the
-- "estimated cost so far" widgets.
create or replace function yt_spend_for_user(p_user_id uuid, p_since timestamptz)
returns numeric as $$
  select coalesce(sum(coalesce(gc.actual_cost_usd, gc.estimated_cost_usd)), 0)
  from yt_generation_costs gc
  join yt_channels c on c.id = gc.channel_id
  where c.user_id = p_user_id
    and gc.created_at >= p_since;
$$ language sql stable;
