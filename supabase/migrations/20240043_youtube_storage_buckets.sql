-- ============================================================
-- Automated YouTube Channel Platform — Storage buckets
-- Both buckets are private. The app never generates public URLs;
-- previews are served via short-lived signed URLs minted server-side
-- after an RLS-scoped query has confirmed the requester owns the row
-- (see apps/youtube/lib/storage.ts). The worker (service-role) reads
-- and writes directly, bypassing RLS as usual for trusted server code.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('music-library', 'music-library', false)
on conflict (id) do nothing;

-- No storage.objects policies are added for the authenticated role —
-- access is intentionally admin-client-only (service role bypasses RLS).
-- This keeps generated video/thumbnail/voiceover files from ever being
-- reachable except through a signed URL your own server issued.
