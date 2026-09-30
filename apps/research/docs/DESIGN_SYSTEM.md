# Design system

Institutional, dense but readable, calm. It should feel like a research terminal, not a trading app, and nothing about it should resemble a crypto casino.

## Colour tokens (`tailwind.config.ts`)

| Token | Hex | Use |
|---|---|---|
| `ink-950` | `#060a13` | Page background |
| `ink-850` | `#0e1526` | Cards |
| `ink-700` / `ink-600` | `#1d2a45` / `#2a3a5c` | Borders, dividers, inputs |
| `fg` / `fg-2` / `fg-3` / `fg-4` | `#e8edf6` … `#5b6a86` | Primary → muted text |
| `accent` | `#4c8dff` | Links, primary actions, focus |
| `pos` | `#2fbf71` | Positive evidence |
| `neu` | `#f0a93b` | Neutral / monitor, and the DEMO DATA badge |
| `neg` | `#ef5b5b` | Risk / negative evidence |
| `series-1…5` | `#3987e5 #d95926 #199e70 #c98500 #9085e9` | Chart series in fixed order (validated dark-mode categorical palette) |

**Rules**

- Signal colours (`pos`, `neu`, `neg`) are reserved for evidence ratings. Each one always appears with an icon and a word (for example "✓ Positive"), so colour is never the only cue. They are never used as chart series colours.
- Score tone: ≥ 65 positive, 45–64 neutral, < 45 negative, always next to the number.
- Text uses text tokens, never a series colour.

## Typography

System UI stack (Inter where installed). Numbers use `.num` (tabular figures). Labels are 11px uppercase with 0.08em tracking.

## Components (`components/ui`)

- `Section`: card with a kicker, title, description and actions slot. Every analysis section uses it.
- `Stat`: labelled figure tile.
- `ScoreRing`, `ScoreBar`, `BlockBar`: score displays.
- `RatingPill`: strong positive → strong negative, or no data. Uses an icon plus a label.
- `SourceTag`: provenance chip (Filing / Provider / Estimate / Editorial / **Demo data**). Hover or focus shows the source, period and update date.
- `Explain`: "Explain simply" popover with Simple and Advanced tabs.
- `Callout`: info, warning and demo variants.

## Charts (`components/charts`)

Recharts with 2px lines, 4px-rounded bar ends, a recessive grid, one y-axis only (never dual-axis), a hover tooltip on every chart, a legend whenever there are ≥ 2 series, and range tabs (3Y/5Y/10Y/MAX for annual data; 1Y–MAX for prices). Part-to-whole data (segments, regions) uses labelled horizontal bars rather than pies.

## Layout

Desktop-first, max width 1440px. A sticky header sits above a sticky section nav. Grids collapse to a single column on phones. Wide tables scroll inside their own container, so the page never scrolls sideways (checked at a 390px viewport).
