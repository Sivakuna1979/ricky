// @ts-nocheck
// Shared with the voice call-out and the order-status board — customers
// only need the last 2 digits (e.g. "33" from "FT-20260729-0033") to spot
// their order, not the full reference.
export function shortOrderNumber(orderNumber: string | null | undefined): string {
  const digits = String(orderNumber ?? '').replace(/\D/g, '')
  return digits ? String(parseInt(digits.slice(-2), 10)) : String(orderNumber ?? '')
}
