// @ts-nocheck
// H79 — the one rounding helper every Phase H calculation uses. Every
// money column in the schema is NUMERIC(12,2) (never a float column), and
// every JS-side sum is rounded through this function before being stored
// or returned — the same round2() convention every prior phase already
// uses (Phase B analytics, Phase G route analytics), kept consistent
// rather than introducing an integer-minor-units convention that would
// clash with 50+ existing DECIMAL(10,2)/(12,2) columns across the app.
export function round2(n: number): number {
  return Math.round((n ?? 0) * 100) / 100
}

export function sum(values: (number | null | undefined)[]): number {
  return round2(values.reduce((s: number, v) => s + (v ?? 0), 0))
}
