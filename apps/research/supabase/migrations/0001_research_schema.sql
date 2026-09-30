-- Evidentia Research — core schema
-- Target: a dedicated Supabase (PostgreSQL 15+) project, separate from FoodTaxi.
-- Conventions:
--   * Money stored as numeric in reporting currency units; currency column alongside.
--   * Every sourced figure carries source_id + period + updated_at (provenance).
--   * Market/fundamental tables are public-read, service-role-write.
--   * User tables are protected by row-level security (owner only).

create extension if not exists "pgcrypto";

-- ───────────────────────── Reference ─────────────────────────
create table public.data_sources (
  id            text primary key,              -- e.g. 'sec-edgar', 'fmp', 'editorial'
  name          text not null,
  tier          text not null check (tier in ('filing','provider','derived','estimate','editorial','demo')),
  url           text,
  created_at    timestamptz not null default now()
);

create table public.companies (
  id                 uuid primary key default gen_random_uuid(),
  ticker             text not null,
  exchange           text not null,
  name               text not null,
  country            text,
  currency           text not null default 'USD',
  sector             text,
  industry           text,
  description        text,
  website            text,
  cik                text,
  isin               text,
  fiscal_year_end_month smallint check (fiscal_year_end_month between 1 and 12),
  ipo_date           date,
  delisted_at        date,                       -- kept for survivorship-bias-free backtests
  ceo                text,
  ceo_since          smallint,
  source_id          text references public.data_sources(id),
  updated_at         timestamptz not null default now(),
  unique (ticker, exchange)
);
create index companies_ticker_idx on public.companies (ticker);
create index companies_sector_idx on public.companies (sector, industry);

create table public.competitors (
  company_id     uuid not null references public.companies(id) on delete cascade,
  competitor_id  uuid not null references public.companies(id) on delete cascade,
  relationship   text,                           -- e.g. 'smartphones', 'cloud'
  source_id      text references public.data_sources(id),
  primary key (company_id, competitor_id)
);

-- ───────────────────────── Market data ─────────────────────────
create table public.prices (
  company_id  uuid not null references public.companies(id) on delete cascade,
  date        date not null,
  open        numeric, high numeric, low numeric,
  close       numeric not null,
  adj_close   numeric,
  volume      bigint,
  source_id   text references public.data_sources(id),
  primary key (company_id, date)
);

-- ───────────────────────── Fundamentals ─────────────────────────
-- One row per company × period × statement. Line items in JSONB keyed by the
-- domain model (lib/domain/types.ts → AnnualFinancials) so new line items do not need migrations.
create table public.financial_statements (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  statement     text not null check (statement in ('income','balance','cash_flow')),
  period_type   text not null check (period_type in ('annual','quarterly','ttm')),
  fiscal_year   smallint not null,
  fiscal_quarter smallint check (fiscal_quarter between 1 and 4),
  period_end    date not null,
  filed_at      date,                            -- point-in-time availability (no look-ahead bias)
  currency      text not null,
  line_items    jsonb not null,
  source_id     text references public.data_sources(id),
  source_url    text,                            -- e.g. link to the 10-K
  updated_at    timestamptz not null default now(),
  unique (company_id, statement, period_type, period_end)
);
create index fs_company_period_idx on public.financial_statements (company_id, period_type, period_end desc);

create table public.company_metrics (             -- derived per-period metrics (computed in code)
  company_id   uuid not null references public.companies(id) on delete cascade,
  period_type  text not null,
  period_end   date not null,
  metric       text not null,                     -- 'roic', 'gross_margin', …
  value        numeric,
  formula_version text not null,
  computed_at  timestamptz not null default now(),
  primary key (company_id, period_type, period_end, metric)
);

create table public.ratios (                      -- market-dependent multiples, daily snapshot
  company_id  uuid not null references public.companies(id) on delete cascade,
  as_of       date not null,
  pe numeric, forward_pe numeric, peg numeric, ps numeric, pb numeric,
  ev_to_ebitda numeric, ev_to_ebit numeric, ev_to_sales numeric, pfcf numeric,
  fcf_yield numeric, earnings_yield numeric, dividend_yield numeric,
  market_cap numeric, enterprise_value numeric,
  primary key (company_id, as_of)
);

create table public.valuations (                  -- DCF / scenario runs with their assumptions
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  kind         text not null check (kind in ('dcf','scenario','graham_number','reverse_dcf')),
  case_name    text,                              -- 'Bear' | 'Base' | 'Bull'
  assumptions  jsonb not null,
  result       jsonb not null,
  user_id      uuid references auth.users(id) on delete cascade, -- null = platform default
  created_at   timestamptz not null default now()
);

-- ───────────────────────── Scores (auditable) ─────────────────────────
create table public.scores (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  as_of            date not null,
  mode             text not null default 'balanced',
  methodology_version text not null,
  overall          smallint check (overall between 0 and 100),
  signal           text,
  data_confidence  smallint check (data_confidence between 0 and 100),
  category_scores  jsonb not null,                -- {financial_strength: 69, …}
  signal_counts    jsonb not null,
  created_at       timestamptz not null default now(),
  unique (company_id, as_of, mode, methodology_version)
);
create index scores_overall_idx on public.scores (as_of, mode, overall desc);

create table public.score_components (            -- every indicator behind a score ("Why 82?")
  score_id     uuid not null references public.scores(id) on delete cascade,
  indicator_id text not null,                     -- 'prof.roic'
  category     text not null,
  value        numeric,
  display      text,
  indicator_score smallint,
  weight       numeric not null,
  rating       text not null,
  points       numeric,                           -- contribution vs neutral baseline
  rationale    text,
  basis        text,
  source_ids   text[] not null default '{}',
  primary key (score_id, indicator_id)
);

-- ───────────────────────── Estimates, earnings, filings, news ─────────────────────────
create table public.analyst_estimates (
  company_id   uuid not null references public.companies(id) on delete cascade,
  as_of        date not null,
  fiscal_period text not null,                    -- 'FY2027'
  analyst_count smallint,
  revenue_avg numeric, revenue_low numeric, revenue_high numeric,
  eps_avg numeric, eps_low numeric, eps_high numeric,
  target_low numeric, target_median numeric, target_mean numeric, target_high numeric,
  source_id    text references public.data_sources(id),
  primary key (company_id, as_of, fiscal_period)
);

create table public.earnings (
  company_id    uuid not null references public.companies(id) on delete cascade,
  period        text not null,
  report_date   date not null,
  eps_actual numeric, eps_estimate numeric,
  revenue_actual numeric, revenue_estimate numeric,
  guidance      jsonb,
  source_id     text references public.data_sources(id),
  primary key (company_id, period)
);

create table public.filings (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  form         text not null,                     -- 10-K, 10-Q, 8-K, DEF 14A, 4
  accession_no text unique,
  filed_at     date not null,
  period_end   date,
  url          text not null,                     -- always link to the original
  source_id    text references public.data_sources(id) default 'sec-edgar'
);
create index filings_company_idx on public.filings (company_id, filed_at desc);

create table public.news (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.companies(id) on delete cascade,
  published_at timestamptz not null,
  headline     text not null,
  url          text not null,
  publisher    text,
  sentiment    text check (sentiment in ('very_negative','negative','neutral','positive','very_positive')),
  sentiment_model text,
  source_id    text references public.data_sources(id)
);
create index news_company_idx on public.news (company_id, published_at desc);

create table public.ai_analysis (                  -- cached AI summaries, always tied to sources
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.companies(id) on delete cascade,
  kind         text not null,                     -- 'filing_summary','risk_extraction','qa'
  input_refs   jsonb not null,                    -- filing ids / sections used
  output       jsonb not null,                    -- statements tagged fact/expectation/assumption/…
  model        text not null,
  created_at   timestamptz not null default now()
);

-- ───────────────────────── Users & plans ─────────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan        text not null default 'free' check (plan in ('free','premium','professional')),
  plan_renews_at timestamptz,
  created_at  timestamptz not null default now()
);

create table public.watchlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Watchlist',
  created_at timestamptz not null default now()
);
-- User tables key on ticker (not companies.id) so users can track any symbol
-- before it has been ingested; ticker validity is enforced by the API layer.
create table public.watchlist_items (
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  ticker       text not null check (ticker ~ '^[A-Z0-9][A-Z0-9.\-]{0,9}$'),
  added_at     timestamptz not null default now(),
  primary key (watchlist_id, ticker)
);

create table public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  base_currency text not null default 'USD',
  created_at  timestamptz not null default now()
);
create table public.portfolio_holdings (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  ticker        text not null check (ticker ~ '^[A-Z0-9][A-Z0-9.\-]{0,9}$'),
  quantity      numeric not null check (quantity > 0),
  purchase_price numeric not null check (purchase_price >= 0),
  purchased_at  date,
  created_at    timestamptz not null default now()
);

create table public.alerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticker      text not null check (ticker ~ '^[A-Z0-9][A-Z0-9.\-]{0,9}$'),
  kind        text not null check (kind in ('price_above','price_below','daily_move','pe_below','pe_above','score_below','score_above','earnings','new_filing','dividend_change','estimate_change','major_news')),
  params      jsonb not null default '{}',
  active      boolean not null default true,
  last_fired_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ───────────────────────── Backtesting ─────────────────────────
create table public.backtests (
  id                  uuid primary key default gen_random_uuid(),
  methodology_version text not null,
  mode                text not null,
  universe            text not null,               -- e.g. 'US large cap incl. delisted'
  start_date          date not null,
  end_date            date not null,
  bucket              text not null check (bucket in ('80-100','60-79','40-59','<40')),
  horizon_years       smallint not null check (horizon_years in (1,3,5)),
  n_observations      integer not null,
  mean_return         numeric,
  median_return       numeric,
  benchmark           text not null,
  benchmark_return    numeric,
  hit_rate            numeric,                     -- share beating benchmark
  notes               text,                        -- bias controls and limitations
  created_at          timestamptz not null default now()
);

-- ───────────────────────── Row-level security ─────────────────────────
alter table public.users              enable row level security;
alter table public.watchlists         enable row level security;
alter table public.watchlist_items    enable row level security;
alter table public.portfolios         enable row level security;
alter table public.portfolio_holdings enable row level security;
alter table public.alerts             enable row level security;
alter table public.valuations         enable row level security;

-- Users can read their own profile but not change their plan (plan changes go through the service role / billing).
create policy "own profile read" on public.users for select using (auth.uid() = id);
create policy "own profile update" on public.users for update using (auth.uid() = id)
  with check (auth.uid() = id and plan = (select u.plan from public.users u where u.id = auth.uid()));

-- Create a profile row (free plan) for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id) values (new.id) on conflict do nothing;
  insert into public.watchlists (user_id, name) values (new.id, 'Watchlist');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create policy "own watchlists" on public.watchlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own watchlist items" on public.watchlist_items for all
  using (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()));
create policy "own portfolios" on public.portfolios for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own holdings" on public.portfolio_holdings for all
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid()));
create policy "own alerts" on public.alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "platform or own valuations" on public.valuations for select using (user_id is null or auth.uid() = user_id);
create policy "insert own valuations" on public.valuations for insert with check (auth.uid() = user_id);

-- Public research data: readable by everyone, writable only by the service role
-- (the service role bypasses RLS; no insert/update policies are granted to anon/authenticated).
do $$
declare t text;
begin
  foreach t in array array['data_sources','companies','competitors','prices','financial_statements','company_metrics','ratios',
                           'scores','score_components','analyst_estimates','earnings','filings','news','ai_analysis','backtests']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select using (true)', t);
  end loop;
end $$;
