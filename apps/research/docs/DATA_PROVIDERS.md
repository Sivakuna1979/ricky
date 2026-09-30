# Data providers

## Modes

| Mode | When | What users see |
|---|---|---|
| **Live** | A provider with the `financials` capability is configured | Sourced figures with provider/filing badges |
| **Demo** | No live provider; ticker has a demo dataset (AAPL) | Every page and figure badged **DEMO DATA**; Data Confidence discounted |
| **Unavailable** | No live provider and no demo dataset | "Full analysis unavailable" — nothing invented |

## Adapters

| Adapter | Capabilities | Env vars | Cost |
|---|---|---|---|
| `fmp` — Financial Modeling Prep (`/stable` API) | search, profile, quote, prices, financials, estimates, earnings | `FMP_API_KEY` | Paid tiers; some endpoints need higher plans |
| `sec-edgar` — SEC EDGAR submissions | filings (10-K, 10-Q, 8-K, DEF 14A, Form 4, 20-F) | `SEC_USER_AGENT` (required by SEC: "Name email") | Free, 10 req/s |
| `demo` | everything, for AAPL only | — | — |

Planned adapters (same interface): **Polygon** (prices, quotes), **Finnhub** (estimates, earnings, news sentiment, insider), **Tiingo** / **Twelve Data** / **Alpha Vantage** (prices, fundamentals), **Nasdaq Data Link** (datasets), **FRED** (macro: rates, inflation, GDP, unemployment). SEC **XBRL company-facts** (`data.sec.gov/api/xbrl/companyfacts`) is the planned free primary source for US statements.

Do not assume any API is free: check each vendor's pricing and **redistribution licence** before exposing data via exports or the API plan.

## Adding a provider

1. Create `lib/providers/<id>/index.ts` exporting a `DataProvider`.
2. Declare `capabilities`, implement `isConfigured()` (env check) and `sourceRef()`.
3. Implement only the methods you support; map vendor fields into `lib/domain/types.ts` with `null` for anything missing or ambiguous — never default to 0.
4. Register it in `lib/providers/registry.ts` and set `DATA_PROVIDER_PRIORITY`.
5. Keep it server-only (never import from a `'use client'` module).

## Caching

Adapters call `fetchJson` with `revalidateSeconds` (quotes 5 min, prices 1 h, statements/estimates 24 h) using the Next.js data cache. The target architecture persists normalised data to Postgres via scheduled ingestion, with `filed_at` for point-in-time correctness.
