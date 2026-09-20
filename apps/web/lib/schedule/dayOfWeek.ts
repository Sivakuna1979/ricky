// @ts-nocheck
// van_schedule.day_of_week uses 0=Monday..6=Sunday (see
// supabase/migrations/20240021_van_schedule.sql and the public van page,
// which has always converted correctly: `(d.getDay() + 6) % 7`).
// JavaScript's native Date.getDay()/getUTCDay() uses 0=Sunday..6=Saturday.
// Anything that queries van_schedule by day_of_week MUST go through this
// conversion — passing a raw getDay()/getUTCDay() value directly is off by
// one for every day except Sunday, and was found to have happened in two
// Phase D automations and one Phase E AI tool during the Phase G data
// audit (G1) that requires inspecting this exact area before building
// route intelligence on top of it. Fixed as part of Phase G — see
// docs/FOODTAXI-TECHNICAL-BASELINE.md's Phase G section for the full list
// of call sites corrected.
export function scheduleDayOfWeek(date: Date): number {
  return (date.getUTCDay() + 6) % 7
}
