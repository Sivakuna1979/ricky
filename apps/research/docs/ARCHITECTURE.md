# Evidentia Research: system architecture

Evidentia is an investment research platform. It answers one question for any listed company:

> *How strong are the positive and negative signals around this company as a potential long-term investment?*

It does this with **deterministic, auditable calculations** over **sourced data**. AI is used to explain and summarise. It never produces scores.

---

## 1. Principles that shape the architecture

| Principle | Architectural consequence |
|---|---|
| Never fabricate data | The domain model uses `null` for missing values. The UI renders `null` as "Data unavailable". Missing indicators are excluded from scores (not scored as 0) and lower Data Confidence. |
| Every figure has provenance | Every statement row, quote, estimate and editorial input carries a `sourceId` that resolves to a `SourceRef` (name, tier, period, updated date, URL). |
| Scores are explainable | Scores come from pure functions (`lib/scoring`). The overall score decomposes exactly into `50 + Σ indicator points`, and the "Why?" panel shows this. |
| AI ≠ scoring | LLM output is limited to narrative, summaries, filing extraction and Q&A. Results are cached with their input references. They never feed the numeric model. |
| Providers are swappable | Vendors implement a `DataProvider` interface per capability. A registry picks one per capability by configured priority. |
| Secrets stay server-side | Adapters run only in server components and route handlers. API keys come from environment variables and never reach the browser. |

---

## 2. System overview

```
                    ┌──────────────────────────── Browser ────────────────────────────┐
                    │  Server-rendered pages + small client islands                   │
                    │  (ScoreExplorer, DcfCalculator, charts, statements, search)     │
                    └───────────────▲─────────────────────────────▲───────────────────┘
                                    │ HTML/RSC                     │ JSON (rate-limited)
┌───────────────────────────────────┴─────────────────────────────┴──────────────────────┐
│ Next.js App Router (apps/research)                                                     │
│                                                                                        │
│  app/            pages & route handlers  ──►  lib/analysis/build.ts (orchestrator)     │
│                                                   │                                    │
│                  ┌────────────────────────────────┼─────────────────────────────┐      │
│                  ▼                                ▼                             ▼      │
│         lib/finance (pure math)         lib/scoring (pure rules)       lib/ai (planned) │
│   metrics · valuation · dcf ·        indicators · engine · weights ·  explain/summarise │
│   technical · scenarios             frameworks · checklist · confidence  (never scores) │
│                  ▲                                                                     │
│                  │ CompanyDataset (normalised domain model, lib/domain/types.ts)       │
│         lib/data/dataset.ts  ──►  lib/providers/registry.ts                            │
│                                     ├─ demo        (illustrative, labelled DEMO)       │
│                                     ├─ fmp         (statements, quotes, estimates)     │
│                                     ├─ sec-edgar   (filings index, free)               │
│                                     └─ …polygon / finnhub / tiingo / twelve-data /     │
│                                          alpha-vantage / nasdaq / fred (same interface)│
└────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴────────────┐
                        │ Supabase (Postgres)    │  companies, statements, metrics, scores,
                        │ Auth · RLS · Storage   │  score_components, users, portfolios…
                        └────────────────────────┘
                                    ▲
                        Scheduled ingestion jobs (cron / queue): pull → normalise →
                        compute metrics → score → persist scores + score_components
```

**Request path (v1, today).** The page calls `getCompanyDataset(ticker)`, then `buildAnalysis(dataset)`, then renders. Provider fetches use the Next.js data cache (`revalidate`), so repeat views don't hit vendors again.

**Request path (target).** Nightly and event-driven jobs write normalised statements and computed scores to Postgres. Pages read from the database (fast, cheap, point-in-time history). The same pure functions run in both paths, so live and batch scores always agree.

---

## 3. Folder structure

```
apps/research/
├── app/                              Next.js App Router
│   ├── page.tsx                      Homepage (hero, search, screens, featured analysis)
│   ├── company/[ticker]/page.tsx     Company analysis dashboard (30 sections)
│   ├── methodology/page.tsx          Methodology, rendered from the engine itself
│   ├── screener|compare|portfolio|academy|sign-in|backtest/   Planned-module pages
│   └── api/
│       ├── search/route.ts           Ticker/company search (zod-validated, rate-limited)
│       └── company/[ticker]/route.ts Full analysis JSON (for exports / API plan)
├── components/
│   ├── ui/                           Design-system primitives (Section, Stat, ScoreRing, RatingPill,
│   │                                 SourceTag, Explain popover)
│   ├── charts/                       Recharts wrappers (AnnualChart, PriceChart, BarList)
│   ├── company/                      Dashboard sections + client islands (ScoreExplorer,
│   │                                 DcfCalculator, CompoundingCalculator, FinancialStatements,
│   │                                 Competitors)
│   └── layout/                       Header, footer/disclaimer, search box
├── lib/
│   ├── domain/types.ts               Canonical domain model (provider-neutral)
│   ├── providers/                    Data-provider abstraction
│   │   ├── types.ts                  DataProvider interface, capabilities, fetch helper
│   │   ├── registry.ts               Capability → provider resolution by priority
│   │   ├── demo/                     Illustrative Apple dataset, demo universe, synthetic prices
│   │   ├── fmp/                      Financial Modeling Prep adapter
│   │   └── sec-edgar/                SEC EDGAR filings adapter
│   ├── data/dataset.ts               Builds a CompanyDataset (live → demo → unavailable)
│   ├── finance/                      Pure financial maths (no I/O)
│   │   ├── stats.ts                  CAGR, growth, mean/median/stdev, curve interpolation
│   │   ├── metrics.ts                Per-year ratios, averages, growth sets, trend classification
│   │   ├── valuation.ts              Current multiples, historical comparison, Graham Number
│   │   ├── dcf.ts                    Two-stage DCF, margin of safety, reverse DCF
│   │   ├── technical.ts              SMA, RSI, MACD, support/resistance, momentum
│   │   └── scenarios.ts              Bear/base/bull modelling, compounding
│   ├── scoring/                      Pure scoring rules (no I/O, no AI)
│   │   ├── indicators.ts             ~80 indicators with curves, weights, rationale, basis
│   │   ├── engine.ts                 Category & overall scores, contributions, labels
│   │   ├── weights.ts                Investor-mode weight presets + custom
│   │   ├── frameworks.ts             Graham, Buffett, Fisher, Lynch, Greenblatt, Munger
│   │   ├── checklist.ts              41-question checklist mapped to indicators
│   │   └── confidence.ts             Data Confidence
│   ├── analysis/                     Orchestration: dataset → CompanyAnalysis
│   ├── content/glossary.ts           "Explain simply" content (simple + advanced)
│   ├── security/rate-limit.ts        API rate limiting
│   └── format.ts                     Number/currency/date formatting ("Data unavailable")
├── supabase/migrations/              Research database schema + RLS
├── tests/                            Vitest: finance primitives + scoring invariants
└── docs/                             This file, SCORING_METHODOLOGY, DATA_PROVIDERS, DESIGN_SYSTEM
```

The layers stay separate: **UI** (`app`, `components`), **financial calculations** (`lib/finance`), **scoring** (`lib/scoring`), **data providers** (`lib/providers`, `lib/data`), **AI** (`lib/ai`, planned) and **database** (`supabase`, planned `lib/db`). `lib/finance` and `lib/scoring` import nothing with side effects, so the same code runs in the browser (interactive DCF, re-weighting), on the server and in batch jobs.

---

## 4. Data-provider architecture

See [DATA_PROVIDERS.md](./DATA_PROVIDERS.md). In summary:

- `DataProvider` declares `capabilities` (`financials`, `quote`, `prices`, `estimates`, `earnings`, `filings`, `ownership`, `short_interest`, `news`, `macro`, `search`). It implements only the methods it supports.
- `isConfigured()` checks its environment variables. `sourceRef()` returns the provenance attached to its figures.
- `registry.providerFor(capability)` returns the highest-priority configured adapter (`DATA_PROVIDER_PRIORITY`).
- `getCompanyDataset()` combines capabilities from different vendors into one `CompanyDataset`. Failures in optional capabilities degrade to "unavailable" and never block the page.
- Field mapping is defensive. An unknown or renamed vendor field maps to `null`, never to a guess.
- Multi-country and multi-currency support is built in: `currency` lives on the profile, formatting is currency-aware, and exchanges are part of the company identity (`unique (ticker, exchange)`).

---

## 5. Scoring methodology

See [SCORING_METHODOLOGY.md](./SCORING_METHODOLOGY.md). The `/methodology` page renders the live weight tables and every indicator's scoring basis directly from the engine, so it cannot drift from the code.

---

## 6. AI research engine (design; phase 14)

**Allowed uses:** explanation, summarisation, filing analysis (10-K/10-Q/8-K/DEF 14A/Form 4), news interpretation, risk identification, qualitative drafting and Q&A.

**Guardrails:**
1. **Grounding.** The assistant receives the computed `CompanyAnalysis` JSON plus retrieved filing passages, and nothing else. Its system prompt forbids stating a number that is not in the supplied context. If a figure isn't there, it answers "Data unavailable".
2. **Epistemic tagging.** Every forward-looking sentence is tagged `fact` / `expectation` / `assumption` / `scenario` / `uncertainty`. This is the same scheme the Outlook section uses.
3. **Citations.** Filing-derived statements carry the filing URL and section anchor, stored in `ai_analysis.input_refs`.
4. **No scoring.** Model output is never parsed into indicator values. Qualitative inputs (moat, risks) can be AI-*drafted*, but they must be reviewed by an analyst before they are stored in the editorial source.
5. **Server-only.** Calls go through a route handler with auth, plan quotas and rate limits. The Anthropic API key stays in an environment variable. The default model is the latest Claude model available.

Example questions: "Explain Apple's debt", "Why has ROIC changed?", "Compare Apple and Microsoft", "Is valuation historically expensive?", "What could the business look like in 10 years?". The answers are assembled from the same indicators the page shows.

---

## 7. Authentication and plans (phase 10)

- **Supabase Auth:** email/password, Google OAuth and Sign in with Apple.
- `users.plan` ∈ `free | premium | professional`. Entitlements are checked **server-side** in route handlers and server components (never only in the UI).

| Feature | Free | Premium | Professional |
|---|:-:|:-:|:-:|
| Company data, basic score, basic charts | ✓ (limited searches) | ✓ | ✓ |
| Full analysis, frameworks, DCF, competitors | | ✓ | ✓ |
| AI research, advanced screener, reports, watchlists, alerts | | ✓ | ✓ (higher limits) |
| Advanced export, portfolio analytics, historical datasets, backtesting, API access | | | ✓ |

---

## 8. Security

- Provider keys (`FMP_API_KEY`, etc.) and `ANTHROPIC_API_KEY` are server-only environment variables. Never use the `NEXT_PUBLIC_` prefix for secrets. Adapters live in modules imported only by server code.
- **Row-level security:** user tables (`watchlists`, `portfolios`, `portfolio_holdings`, `alerts`, `users`, user valuations) are owner-only. Research tables are public-read and service-role-write.
- **Input validation:** tickers are normalised by `normaliseTicker` (`^[A-Z0-9][A-Z0-9.\-]{0,9}$`). Query parameters are parsed with zod.
- **Rate limiting:** `lib/security/rate-limit.ts` (in-memory fixed window, per instance). In production, use Upstash/Redis or the platform firewall.
- **Security headers:** `X-Content-Type-Options`, `X-Frame-Options: DENY` and `Referrer-Policy` are set in `next.config.js`. The next step is a CSP.
- **Licensing:** many paid data licences restrict redistribution. The `/api/company` JSON endpoint and exports must respect each vendor's terms before they are exposed to Professional/API users.

---

## 9. Reports and exports

v1 uses the browser's print-to-PDF ("Export report"). The planned version renders a server-side PDF (for example with `@react-pdf/renderer` or headless Chromium) containing the executive summary, company overview, financials, growth, valuation, moat, management, risks, scenarios, checklist and a sources appendix.

---

## 10. Backtesting (phase 15)

Goal: find out whether higher scores were followed by better returns, and publish the answer whatever it is.

- **Point-in-time data.** `financial_statements.filed_at` means a score as of date *D* only uses filings filed before *D*. Prices, estimates and editorial inputs are versioned the same way.
- **No survivorship bias.** `companies.delisted_at` keeps delisted and acquired companies in the universe. Delisting returns are included.
- **Buckets:** 80–100, 60–79, 40–59, and below 40. Forward horizons: 1, 3 and 5 years. Returns are compared with the relevant index (S&P 500, NASDAQ, sector index).
- **Outputs:** mean and median return, hit rate against the benchmark, and dispersion. Results are stored in `backtests` with `methodology_version`, so methodology changes can be compared.
- Weights are **not** tuned on the same period that is used to evaluate them. Walk-forward validation is used instead.

---

## 11. Build roadmap

| # | Deliverable | Status |
|---|---|---|
| 1 | System architecture | ✅ this document |
| 2 | Folder structure | ✅ |
| 3 | Database schema | ✅ `supabase/migrations/0001_research_schema.sql` |
| 4 | Data-provider architecture | ✅ demo, FMP and SEC EDGAR adapters with registry |
| 5 | Scoring methodology | ✅ engine, tests and `/methodology` |
| 6 | UI design system | ✅ `DESIGN_SYSTEM.md` and `components/ui` |
| 7 | Homepage | ✅ |
| 8 | Company analysis page | ✅ 30 sections |
| 9 | Apple demo | ✅ labelled DEMO DATA |
| 10 | Authentication and plans | ⏭ next |
| 11 | Screener | planned |
| 12 | Comparison (up to 5) | planned |
| 13 | Portfolio, watchlist and alerts | planned |
| 14 | AI research assistant | planned (design above) |
| 15 | Backtesting | planned (design above) |
