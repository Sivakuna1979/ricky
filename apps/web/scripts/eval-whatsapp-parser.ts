// Phase B — eval harness for lib/ai/whatsappOrderParser.ts.
//
// Run with: npm run eval:whatsapp
//
// Calls the REAL Anthropic API for each of the 40 fixtures (costs real
// tokens — logged to ai_usage_log like any other call, feature
// 'whatsapp_order_parse'). Not part of `npm test`: this is a model-quality
// gate, not a unit test, and must never block a normal CI run on model
// nondeterminism. CI only runs it when the parser or its fixtures change
// (see .github/workflows/eval.yml), and only if ANTHROPIC_API_KEY is set.
import { parseWhatsAppOrderMessage } from '../lib/ai/whatsappOrderParser'
import { MENU, CASES, type EvalCase, type ExpectedItem } from '../eval/whatsapp-order-parser/fixtures'

// A pass threshold rather than 100% — this grades a real model's natural-
// language extraction, where a little run-to-run variance is expected and
// should not make every prompt tweak a red herring. Tightening/loosening
// this is itself a deliberate quality decision, not a knob to silence a
// failure.
const PASS_THRESHOLD = 0.85

type ItemResult = { ok: true } | { ok: false; reason: string }

function scoreItems(expected: ExpectedItem[], actual: { menu_item_id: string | null; quantity: number; price: number }[]): ItemResult {
  const remaining = [...actual]
  for (const exp of expected) {
    const idx = remaining.findIndex(a =>
      a.menu_item_id === exp.menu_item_id &&
      a.quantity === exp.quantity &&
      Math.abs(a.price - exp.price) < 0.005
    )
    if (idx === -1) {
      const near = remaining.find(a => a.menu_item_id === exp.menu_item_id)
      return {
        ok: false,
        reason: near
          ? `expected ${exp.menu_item_id} qty=${exp.quantity} price=${exp.price}, got qty=${near.quantity} price=${near.price}`
          : `missing item ${exp.menu_item_id ?? '(off-menu)'} qty=${exp.quantity}`,
      }
    }
    remaining.splice(idx, 1)
  }
  if (remaining.length) {
    return { ok: false, reason: `unexpected extra item(s): ${remaining.map(r => `${r.menu_item_id ?? '(off-menu)'}x${r.quantity}`).join(', ')}` }
  }
  return { ok: true }
}

async function runCase(c: EvalCase) {
  const result = await parseWhatsAppOrderMessage({ menu: MENU, text: c.message })
  if (result.ok === false) {
    return { id: c.id, pass: false, reason: `parser returned ${result.reason}, expected items`, softWarnings: [] as string[] }
  }
  const itemScore = scoreItems(c.expectedItems, result.order.items)
  const itemFailureReason = itemScore.ok === false ? itemScore.reason : null
  const softWarnings: string[] = []
  if (c.expectedCustomerNameContains && !result.order.customer_name?.toLowerCase().includes(c.expectedCustomerNameContains.toLowerCase())) {
    softWarnings.push(`customer_name expected to contain "${c.expectedCustomerNameContains}", got "${result.order.customer_name}"`)
  }
  if (c.expectedNotesContains && !result.order.notes?.toLowerCase().includes(c.expectedNotesContains.toLowerCase())) {
    softWarnings.push(`notes expected to mention "${c.expectedNotesContains}", got "${result.order.notes}"`)
  }
  return { id: c.id, pass: itemScore.ok, reason: itemFailureReason, softWarnings }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set — cannot run a real-model eval. Skipping.')
    process.exit(0)
  }

  console.log(`Running ${CASES.length}-case WhatsApp order parser eval...\n`)
  const results = []
  for (const c of CASES) {
    try {
      const r = await runCase(c)
      results.push(r)
      console.log(`${r.pass ? '✓' : '✗'} [${r.id}] ${c.message}${r.pass ? '' : `\n    ${r.reason}`}`)
      for (const w of r.softWarnings) console.log(`    ⚠ ${w}`)
    } catch (err: any) {
      results.push({ id: c.id, pass: false, reason: `threw: ${err?.message}`, softWarnings: [] })
      console.log(`✗ [${c.id}] ${c.message}\n    threw: ${err?.message}`)
    }
  }

  const passed = results.filter(r => r.pass).length
  const rate = passed / results.length
  console.log(`\n${passed}/${results.length} passed (${(rate * 100).toFixed(1)}%), threshold ${(PASS_THRESHOLD * 100).toFixed(0)}%`)

  if (rate < PASS_THRESHOLD) {
    console.error('Eval pass rate below threshold.')
    process.exit(1)
  }
}

main()
