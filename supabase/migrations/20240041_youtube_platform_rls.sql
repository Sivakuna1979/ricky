-- ============================================================
-- Automated YouTube Channel Platform — Row Level Security
-- Ownership traces to yt_channels.user_id = auth.uid() (directly
-- or via parent FK). The background worker uses the service-role
-- client and bypasses RLS entirely — it never runs with a user JWT.
-- ============================================================

alter table yt_profiles enable row level security;
alter table yt_api_credentials enable row level security;
alter table yt_channels enable row level security;
alter table yt_niches enable row level security;
alter table yt_channel_settings enable row level security;
alter table yt_topics enable row level security;
alter table yt_research_sources enable row level security;
alter table yt_scripts enable row level security;
alter table yt_voiceovers enable row level security;
alter table yt_media_assets enable row level security;
alter table yt_videos enable row level security;
alter table yt_video_metadata enable row level security;
alter table yt_thumbnails enable row level security;
alter table yt_schedules enable row level security;
alter table yt_uploads enable row level security;
alter table yt_playlists enable row level security;
alter table yt_playlist_videos enable row level security;
alter table yt_analytics enable row level security;
alter table yt_generation_costs enable row level security;
alter table yt_approvals enable row level security;
alter table yt_policy_checks enable row level security;
alter table yt_copyright_checks enable row level security;
alter table yt_job_logs enable row level security;
alter table yt_notifications enable row level security;

-- Direct-owner tables -----------------------------------------------------

create policy yt_profiles_owner on yt_profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy yt_api_credentials_owner on yt_api_credentials
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy yt_channels_owner on yt_channels
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy yt_niches_owner on yt_niches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy yt_notifications_owner on yt_notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- One hop from yt_channels -------------------------------------------------

create policy yt_channel_settings_owner on yt_channel_settings
  for all using (channel_id in (select id from yt_channels where user_id = auth.uid()))
  with check (channel_id in (select id from yt_channels where user_id = auth.uid()));

create policy yt_topics_owner on yt_topics
  for all using (channel_id in (select id from yt_channels where user_id = auth.uid()))
  with check (channel_id in (select id from yt_channels where user_id = auth.uid()));

create policy yt_videos_owner on yt_videos
  for all using (channel_id in (select id from yt_channels where user_id = auth.uid()))
  with check (channel_id in (select id from yt_channels where user_id = auth.uid()));

create policy yt_schedules_owner on yt_schedules
  for all using (channel_id in (select id from yt_channels where user_id = auth.uid()))
  with check (channel_id in (select id from yt_channels where user_id = auth.uid()));

create policy yt_uploads_owner on yt_uploads
  for all using (channel_id in (select id from yt_channels where user_id = auth.uid()))
  with check (channel_id in (select id from yt_channels where user_id = auth.uid()));

create policy yt_playlists_owner on yt_playlists
  for all using (channel_id in (select id from yt_channels where user_id = auth.uid()))
  with check (channel_id in (select id from yt_channels where user_id = auth.uid()));

create policy yt_generation_costs_owner on yt_generation_costs
  for all using (channel_id in (select id from yt_channels where user_id = auth.uid()))
  with check (channel_id in (select id from yt_channels where user_id = auth.uid()));

create policy yt_approvals_owner on yt_approvals
  for all using (channel_id in (select id from yt_channels where user_id = auth.uid()))
  with check (channel_id in (select id from yt_channels where user_id = auth.uid()));

create policy yt_job_logs_owner on yt_job_logs
  for all using (channel_id in (select id from yt_channels where user_id = auth.uid()))
  with check (channel_id in (select id from yt_channels where user_id = auth.uid()));

-- Two hops (via yt_topics -> yt_channels) ----------------------------------

create policy yt_research_sources_owner on yt_research_sources
  for all using (topic_id in (
    select t.id from yt_topics t join yt_channels c on c.id = t.channel_id where c.user_id = auth.uid()
  ))
  with check (topic_id in (
    select t.id from yt_topics t join yt_channels c on c.id = t.channel_id where c.user_id = auth.uid()
  ));

create policy yt_scripts_owner on yt_scripts
  for all using (topic_id in (
    select t.id from yt_topics t join yt_channels c on c.id = t.channel_id where c.user_id = auth.uid()
  ))
  with check (topic_id in (
    select t.id from yt_topics t join yt_channels c on c.id = t.channel_id where c.user_id = auth.uid()
  ));

-- Two hops (via yt_scripts -> yt_topics -> yt_channels) --------------------

create policy yt_voiceovers_owner on yt_voiceovers
  for all using (script_id in (
    select s.id from yt_scripts s
    join yt_topics t on t.id = s.topic_id
    join yt_channels c on c.id = t.channel_id
    where c.user_id = auth.uid()
  ))
  with check (script_id in (
    select s.id from yt_scripts s
    join yt_topics t on t.id = s.topic_id
    join yt_channels c on c.id = t.channel_id
    where c.user_id = auth.uid()
  ));

-- Via yt_videos -> yt_channels ---------------------------------------------

create policy yt_media_assets_owner on yt_media_assets
  for all using (
    video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid()))
    or topic_id in (select t.id from yt_topics t join yt_channels c on c.id = t.channel_id where c.user_id = auth.uid())
  )
  with check (
    video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid()))
    or topic_id in (select t.id from yt_topics t join yt_channels c on c.id = t.channel_id where c.user_id = auth.uid())
  );

create policy yt_video_metadata_owner on yt_video_metadata
  for all using (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())))
  with check (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())));

create policy yt_thumbnails_owner on yt_thumbnails
  for all using (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())))
  with check (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())));

create policy yt_analytics_owner on yt_analytics
  for all using (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())))
  with check (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())));

create policy yt_policy_checks_owner on yt_policy_checks
  for all using (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())))
  with check (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())));

create policy yt_copyright_checks_owner on yt_copyright_checks
  for all using (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())))
  with check (video_id in (select id from yt_videos where channel_id in (select id from yt_channels where user_id = auth.uid())));

create policy yt_playlist_videos_owner on yt_playlist_videos
  for all using (playlist_id in (select id from yt_playlists where channel_id in (select id from yt_channels where user_id = auth.uid())))
  with check (playlist_id in (select id from yt_playlists where channel_id in (select id from yt_channels where user_id = auth.uid())));
