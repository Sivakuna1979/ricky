// @ts-nocheck
// K4 — reuses Phase D's exact INFO/ACTION/IMPORTANT/CRITICAL scheme
// (lib/automations/engine.ts's NotifyParams.priority) rather than
// inventing a second one. Priority is always assigned by a deterministic
// rule in application code (see lib/commandCentre/exceptions.ts and
// opportunities.ts) — never left for the AI to judge, so "the LLM must
// not arbitrarily mark everything critical" is true by construction: the
// AI owner-brief tools only ever read priorities already computed here.
export type Priority = 'INFO' | 'ACTION' | 'IMPORTANT' | 'CRITICAL'

export const PRIORITY_ORDER: Priority[] = ['CRITICAL', 'IMPORTANT', 'ACTION', 'INFO']

// Single source of truth for priority display — components/notifications/
// NotificationCentre.tsx (Phase D) imports this too, rather than keeping
// its own separate copy of the same four colours.
export const PRIORITY_META: Record<Priority, { color: string; label: string }> = {
  CRITICAL: { color: '#991b1b', label: 'Critical' },
  IMPORTANT: { color: '#dc2626', label: 'Important' },
  ACTION: { color: '#f59e0b', label: 'Action' },
  INFO: { color: '#6366f1', label: 'Info' },
}

export function sortByPriority<T extends { priority: Priority }>(items: T[]): T[] {
  return [...items].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
}
