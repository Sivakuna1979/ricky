// @ts-nocheck
// Shared UK phone normalisation — extracted from lib/notify/channels.ts
// (Phase D) rather than duplicated, so Phase I's customer identity
// resolution (I3) and Phase D's automation SMS sender use exactly the
// same rule and can never disagree about what a phone number normalises
// to.
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('0')) return `+44${trimmed.slice(1)}`
  return trimmed
}
