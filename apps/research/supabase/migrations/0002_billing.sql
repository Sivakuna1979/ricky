-- Billing: Premium = 3-month free trial, then £9.99/month (Stripe).
-- The plan column is only ever changed by the Stripe webhook (service role).
alter table public.users
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status    text,          -- trialing | active | past_due | canceled | incomplete | unpaid …
  add column if not exists trial_ends_at          timestamptz,
  add column if not exists current_period_end     timestamptz,
  add column if not exists cancel_at_period_end   boolean not null default false,
  add column if not exists has_used_trial         boolean not null default false;

-- Users may read their billing state but not change it.
drop policy if exists "own profile update" on public.users;
create policy "own profile update" on public.users for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select u.plan from public.users u where u.id = auth.uid())
    and stripe_customer_id is not distinct from (select u.stripe_customer_id from public.users u where u.id = auth.uid())
    and subscription_status is not distinct from (select u.subscription_status from public.users u where u.id = auth.uid())
    and has_used_trial = (select u.has_used_trial from public.users u where u.id = auth.uid())
  );
