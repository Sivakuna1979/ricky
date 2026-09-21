// @ts-nocheck
// Phase N — structured logging. Vercel captures stdout/stderr natively
// and ships it to the dashboard/log drains, so this is deliberately just a
// consistent JSON shape over console.log/console.error — no logging SaaS
// is required to get structured, searchable logs. If the deployment later
// adds a log drain (Datadog, Axiom, etc.) this shape is what it will
// ingest with no code change here.
//
// Fields are kept to what's safe to log: never a full request body, never
// a secret/token/password, never raw card/payment details (L58's existing
// logging-safety rule for payments carries over here as the general
// rule). Callers pass only IDs and short descriptive strings.

type LogFields = {
  scope: string // e.g. 'orders.guest', 'webhooks.whatsapp', 'ai.chat'
  action?: string // e.g. 'create', 'confirm', 'webhook_received'
  status?: 'ok' | 'error' | 'rejected'
  businessId?: string | null
  requestId?: string | null
  durationMs?: number
  error?: string
  [key: string]: unknown
}

function write(level: 'info' | 'warn' | 'error', fields: LogFields) {
  const line = {
    ts: new Date().toISOString(),
    level,
    ...fields,
  }
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(line))
}

export const log = {
  info: (fields: LogFields) => write('info', fields),
  warn: (fields: LogFields) => write('warn', fields),
  error: (fields: LogFields) => write('error', fields),
}

// Short random id for correlating a single request's log lines without a
// dependency — collision risk is irrelevant here (it's a log-grep aid, not
// a security token).
export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
