#!/usr/bin/env node
// Preflight check: reports which integrations are configured and whether the
// Supabase database is reachable with the agent platform tables present.
// Run with:  npm run check
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Load .env.local (and .env) without a dependency.
function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const val = m[2].replace(/^["']|["']$/g, '')
      if (!(m[1] in process.env)) process.env[m[1]] = val
    }
  }
}
loadEnv()

const has = (k) => Boolean(process.env[k] && !process.env[k].includes('your-') && process.env[k] !== 'change-me')
const C = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', dim: '\x1b[2m', reset: '\x1b[0m' }
const mark = (ok) => (ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`)
const opt = `${C.yellow}○${C.reset}`

console.log('\nAgentHub preflight\n==================\n')

const required = [
  ['Supabase URL', 'NEXT_PUBLIC_SUPABASE_URL'],
  ['Supabase anon key', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  ['Supabase service role', 'SUPABASE_SERVICE_ROLE_KEY'],
  ['Anthropic API key', 'ANTHROPIC_API_KEY'],
  ['App URL', 'NEXT_PUBLIC_APP_URL'],
]
let requiredOk = true
console.log('Required:')
for (const [label, key] of required) {
  const ok = has(key)
  if (!ok) requiredOk = false
  console.log(`  ${mark(ok)} ${label} ${C.dim}(${key})${C.reset}`)
}

const features = [
  ['Scheduled jobs', () => has('CRON_SECRET')],
  ['Billing (Stripe)', () => has('STRIPE_SECRET_KEY') && has('STRIPE_PRICE_PRO')],
  ['Web search', () => has('SERPER_API_KEY')],
  ['Image generation', () => has('IMAGE_API_KEY')],
  ['Voice (speech-to-text)', () => has('STT_API_KEY')],
  ['Google Workspace', () => has('GOOGLE_CLIENT_ID') && has('GOOGLE_CLIENT_SECRET')],
]
console.log('\nOptional features:')
for (const [label, test] of features) {
  const ok = test()
  console.log(`  ${ok ? mark(true) : opt} ${label}${ok ? '' : `  ${C.dim}not configured${C.reset}`}`)
}

// Check DB connectivity + that the migration ran.
async function checkDb() {
  if (!has('NEXT_PUBLIC_SUPABASE_URL') || !has('SUPABASE_SERVICE_ROLE_KEY')) {
    console.log(`\nDatabase: ${C.yellow}skipped${C.reset} (Supabase env not set)\n`)
    return
  }
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/rest/v1/workspaces?select=id&limit=1`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    if (res.ok) {
      console.log(`\nDatabase: ${mark(true)} reachable and 'workspaces' table exists\n`)
    } else if (res.status === 404 || res.status === 400) {
      console.log(
        `\nDatabase: ${C.red}✗${C.reset} reachable but tables missing — run the migration:` +
          `\n  ${C.dim}supabase db push${C.reset}  (from repo root)\n`
      )
    } else {
      console.log(`\nDatabase: ${C.red}✗${C.reset} HTTP ${res.status} — check your keys\n`)
    }
  } catch (e) {
    console.log(`\nDatabase: ${C.red}✗${C.reset} ${e.message}\n`)
  }
}

await checkDb()

if (!requiredOk) {
  console.log(`${C.red}Missing required config.${C.reset} Copy .env.local.example → .env.local and fill it in.\n`)
  process.exit(1)
}
console.log(`${C.green}Required config looks good.${C.reset}\n`)
