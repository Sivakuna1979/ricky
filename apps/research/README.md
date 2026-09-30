# Evidentia Research (`apps/research`)

An evidence-based investment research platform. It gives any listed company a transparent **Investment Quality Score** that shows where every point came from, with sourced figures, investor-framework analyses, an interactive DCF, scenarios and risk analysis.

> This platform provides financial information, research tools and educational analysis. It does not constitute personalised financial advice.

## Run

```bash
cd apps/research
npm install
npm run dev        # http://localhost:3002
npm test           # finance + scoring invariants
npm run build
```

With no API keys set, the app runs in **demo mode**. `/company/AAPL` runs end-to-end on an illustrative dataset in which every figure is labelled **DEMO DATA**. To use sourced data, copy `.env.example` to `.env.local` and set `FMP_API_KEY` and `SEC_USER_AGENT`.

## Docs

- [Architecture](docs/ARCHITECTURE.md): system design, folder structure, security, AI guardrails, backtesting, roadmap
- [Scoring methodology](docs/SCORING_METHODOLOGY.md) (also rendered live at `/methodology`)
- [Data providers](docs/DATA_PROVIDERS.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- Database schema: `supabase/migrations/0001_research_schema.sql`. This targets its own Supabase project, not the FoodTaxi database.
