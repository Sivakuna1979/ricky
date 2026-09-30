# Scoring methodology (v1)

The **Investment Quality Score (0–100)** measures how strong the positive and negative evidence around a company is, under a published and deterministic method. It is **not** a probability that the price will rise, and it is **not** a recommendation.

Source of truth: `lib/scoring/*`. The `/methodology` page renders every indicator's scoring basis straight from the code.

## 1. Pipeline

1. **Metrics.** `lib/finance/metrics.ts` computes per-year ratios from sourced statements.
   - ROIC = EBIT × (1 − effective tax rate) ÷ (total debt + equity − cash − short-term investments). The effective tax rate is clamped to 0–50%.
   - ROE = net income ÷ average equity. ROA = net income ÷ average total assets.
   - FCF = operating cash flow − capex. Net debt = total debt − cash − short-term investments. This is conservative because long-term investments are excluded.
   - Growth rates use CAGR and return `null` when the starting value is ≤ 0.
2. **Indicators.** `lib/scoring/indicators.ts` maps each metric onto 0–100 with a piecewise-linear curve (for example, ROIC 5%→15, 8%→40, 12%→60, 20%→85, 30%→100). 50 is neutral. Each indicator records its value, display, score, weight within its category, rating, rationale, **basis** (formula + curve) and `sourceIds`.
3. **Ratings.** ≥85 strong positive · ≥65 positive · ≥45 neutral · ≥25 negative · <25 strong negative · `null` = no data.
4. **Categories.** Each category score is the weighted mean of that category's indicators *that have data*.
5. **Overall.** Σ (category weight × category score). Weights come from the investor mode and are renormalised over categories that have data. Excluded categories are listed explicitly.
6. **Audit identity.** `overall = 50 + Σ_i points_i`, where `points_i = w_cat × v_i × (s_i − 50) ÷ Σv_cat`. A test enforces this, and the "Why?" panel displays it.

## 2. Categories and default weights

| Category | Balanced | Value | Quality | Growth | Dividend | GARP | Buffett | Graham | Lynch |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Financial Strength | 15 | 15 | 17.5 | 7.5 | 15 | 10 | 12.5 | 30 | 12.5 |
| Business Quality / Moat | 15 | 10 | 22.5 | 12.5 | 7.5 | 12.5 | 25 | 5 | 15 |
| Profitability | 10 | 7.5 | 17.5 | 10 | 7.5 | 10 | 12.5 | 7.5 | 7.5 |
| Growth | 10 | 5 | 7.5 | 35 | 5 | 20 | 5 | 5 | 25 |
| Cash Flow | 10 | 12.5 | 12.5 | 10 | 15 | 10 | 17.5 | 10 | 7.5 |
| Valuation | 15 | 30 | 7.5 | 7.5 | 10 | 22.5 | 15 | 32.5 | 22.5 |
| Management & Capital Allocation | 10 | 7.5 | 7.5 | 5 | 5 | 7.5 | 10 | 2.5 | 5 |
| Risk (higher = lower risk) | 10 | 10 | 5 | 7.5 | 7.5 | 5 | 2.5 | 7.5 | 5 |
| Market / Technical | 2.5 | 1.25 | 1.25 | 3 | 1 | 1.25 | 0 | 0 | 0 |
| Sentiment / Other | 2.5 | 1.25 | 1.25 | 2 | 1 | 1.25 | 0 | 0 | 0 |
| Dividend | 0 | 0 | 0 | 0 | 25.5 | 0 | 0 | 0 | 0 |

Users can also define a **custom** strategy. Short-term technicals are capped at small weights by design.

## 3. Indicator families

- **Financial strength:** net debt/EBITDA, interest coverage, current and quick ratios, debt/equity, FCF/debt, goodwill share.
- **Profitability:** gross, operating and net margins; ROIC; ROE (capped at 75 when debt > equity, because buybacks flatter it); ROA; margin trend.
- **Growth:** revenue 1/3/5/10-year growth; EPS 3/5-year; FCF and operating-income 5-year; consensus next-year revenue and EPS (third-party estimates, low weight); trend classification (accelerating, stable, slowing, declining).
- **Cash flow:** FCF margin; FCF conversion; **NI vs OCF divergence flag** (profits up while OCF falls more than 5%); FCF consistency; SBC/FCF; capex intensity.
- **Valuation:** P/E, forward P/E, EV/EBITDA, P/FCF, P/S and EV/EBIT, each scored on its premium against the average of available references (5-year average, 10-year average, industry median, peer median). Also PEG, FCF yield, EBIT/EV and base-case DCF margin of safety. No single ratio decides the verdict.
- **Business quality / moat:** editorial moat rubric (10 sources rated 0–3 with evidence); ROIC ≥ 15% persistence; gross-margin stability; pricing power.
- **Management:** 5-year share count change; (dividends + buybacks)/FCF; SBC/revenue; acquisition spend/FCF; ROIC trend; CEO tenure (a measurable fact only); insider ownership.
- **Risk:** quantitative debt, valuation premium, dilution, cyclicality and segment concentration; editorial risk factors (regulation, geopolitics, suppliers, competition, disruption, litigation, currency, slowdown, key person, commodity, rates) scored Low 90 · Moderate 65 · Elevated 40 · High 15; short interest.
- **Technical:** price vs SMA200 (overextension scores lower), 50/200 cross, RSI, MACD, 12-month momentum.
- **Sentiment:** news sentiment and estimate revisions. These are unavailable until a news provider is connected.
- **Dividend:** payout ratio, FCF payout, 5-year DPS CAGR, growth streak and yield.

## 4. Derived labels

- **Overall signal:** Strong ≥ 80 · Favourable ≥ 65 · Mixed ≥ 50 · Weak ≥ 35 · Very Weak.
- **Valuation:** Deeply Undervalued ≥ 80 · Undervalued ≥ 65 · Fairly Valued ≥ 50 · Premium ≥ 38 · Expensive ≥ 25 · Extremely Expensive.
- **Balance sheet:** Very Strong ≥ 80 · Strong ≥ 65 · Moderate ≥ 50 · Weak ≥ 35 · High Risk.
- **Risk:** LOW ≥ 75 · MODERATE ≥ 60 · ELEVATED ≥ 45 · HIGH.
- **Moat:** score = 60% rubric + 40% quantitative. Exceptional ≥ 92 · Wide ≥ 72 · Moderate ≥ 55 · Narrow ≥ 35 · None.
- **Dividend Safety:** mean of payout, FCF payout, financial-strength category and FCF consistency.
- **Future Opportunity:** mean of growth category, consensus growth, R&D intensity, market runway and moat. **Future Risk** = 100 − (0.7 × risk score + 0.3 × valuation-risk score).

## 5. Investor frameworks (shown alongside the score, not inside it)

Each framework is a list of pass / partial / fail / not-applied criteria. Its score is the mean of the applicable criteria (pass 1, partial 0.5).

- **Graham:** size, current ratio ≥ 2, LT debt < net current assets, debt/assets, earnings stability, dividend record, EPS growth, P/E on 3-year EPS, P/B (or P/E×P/B ≤ 22.5), price vs Graham Number. **Asset-light rule:** when P/B > 10 and ROIC > 25%, the book-value tests are marked *not applied*, and the unadjusted classic score is shown next to the adjusted one.
- **Buffett-style, Fisher, Lynch** (with category classification: Slow Grower, Stalwart, Fast Grower, Cyclical, Turnaround, Asset Play), **Greenblatt** (EBIT/EV plus return on tangible capital) and **Munger**. None of these implies endorsement by the named investor.

## 6. Data Confidence

Coverage 40% · freshness 20% · source reliability 25% (filing 100 · provider 90 · derived 90 · estimate/editorial 70 · demo 35) · historical depth 15%. Cross-source consensus is reported but not yet scored.

## 7. Known limitations (v1)

- Multiples use the latest fiscal year, not TTM. TTM arrives with quarterly data.
- Industry medians and peers depend on provider coverage. When they are absent, only historical references are used.
- Curves are expert-set, not fitted. The backtesting module (see ARCHITECTURE §10) will test whether the score has any predictive usefulness. Until then it is an organised summary of evidence.
- Editorial inputs are subjective by nature. They are labelled as such and carry written evidence.

## 8. Versioning

Scores are persisted with `methodology_version`. Any change to a curve, weight or indicator increments the version, so historical scores stay reproducible.
