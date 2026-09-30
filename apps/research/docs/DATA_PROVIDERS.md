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
| `sec-edgar` — SEC EDGAR (XBRL company facts, submissions, ticker list) | search (all SEC tickers), profile, **financials**, filings | `SEC_USER_AGENT` ("Name email", required by SEC) | **Free**, 10 req/s |
| `fmp` — Financial Modeling Prep (`/stable` API) | search, profile, quote, prices (daily), financials, estimates, earnings | `FMP_API_KEY` | Paid tiers |
| `alpha-vantage` — Alpha Vantage | quote, prices (weekly adjusted) | `ALPHA_VANTAGE_API_KEY` | Free tier (low limits) + paid |
| `demo` | everything, for AAPL only | — | — |

Default priority is `sec-edgar,fmp,alpha-vantage`: statements come from primary-source filings when SEC is configured; quotes and prices come from the first configured price provider.

### SEC XBRL parsing rules (`lib/providers/sec-edgar/xbrl.ts`)

- Fiscal years are identified from the period each annual report (10-K / 20-F / 40-F) actually covers — comparative columns do not create years.
- Flow items use full-year durations (300–400 days) from annual reports only; quarterly and Q4-only facts are ignored. Balance-sheet items are instants at the fiscal-year end.
- Restated figures: the most recently filed value wins.
- Concept names that changed over time (e.g. `SalesRevenueNet` → `RevenueFromContractWithCustomerExcludingAssessedTax`) are tried per year.
- **Stock splits:** older filings report pre-split per-share data while price histories are split-adjusted. A year-over-year diluted share jump close to a standard ratio (2, 3, 4, 5, 7, 8, 10, 15, 20 — or the inverse for reverse splits) is treated as a split, and earlier years' shares, EPS and DPS are restated to today's basis.
- Market cap = price × cover-page shares outstanding (`dei:EntityCommonStockSharesOutstanding`).
- Anything not reported is `null`. Company-facts files can exceed the Next.js data-cache item limit, so parsed data is cached in memory (12 h).
- Not covered by XBRL: segment/geographic revenue (varies by filer), business description, analyst estimates, prices.

Planned adapters (same interface): **Polygon** (prices), **Finnhub** (estimates, earnings, news sentiment, insider), **Tiingo** / **Twelve Data**, **Nasdaq Data Link**, **FRED** (macro).

Do not assume any API is free: check each vendor's pricing and **redistribution licence** before exposing data via exports or the API plan.

## Adding a provider

1. Create `lib/providers/<id>/index.ts` exporting a `DataProvider`.
2. Declare `capabilities`, implement `isConfigured()` (env check) and `sourceRef()`.
3. Implement only the methods you support; map vendor fields into `lib/domain/types.ts` with `null` for anything missing or ambiguous — never default to 0.
4. Register it in `lib/providers/registry.ts` and set `DATA_PROVIDER_PRIORITY`.
5. Keep it server-only (never import from a `'use client'` module).

## Caching

Adapters call `fetchJson` with `revalidateSeconds` (quotes 5 min, prices 1 h, statements/estimates 24 h) using the Next.js data cache. The target architecture persists normalised data to Postgres via scheduled ingestion, with `filed_at` for point-in-time correctness.
