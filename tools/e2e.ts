// End-to-end run of the demo against the hosted project, through the real edge functions and RLS.
// Run after `supabase/demo_reset.sql`: node tools/e2e.ts
// Expected results come from docs/checks.md. Mock data only.
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import world from '../samples/world.json' with { type: 'json' }
import manifest from '../samples/manifest.json' with { type: 'json' }

const ROOT = new URL('..', import.meta.url).pathname
process.loadEnvFile(ROOT + '.env.local')
const party = (k: string) => world.parties.find((p) => p.key === k)!.id
let failures = 0

async function as(user: string) {
  const c = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: `${user}@invoseal.test`, password: process.env.DEMO_PASSWORD! })
  if (error) throw new Error(`${user}: ${error.message}`)
  return c
}
async function fn(c: SupabaseClient, name: string, body: Record<string, unknown>) {
  const { data, error } = await c.functions.invoke(name, { body })
  if (error) {
    const msg = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => null)
    throw new Error(`${name}: ${msg ?? error.message}`)
  }
  return data
}
function expect(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failures++
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}: ${JSON.stringify(got)}${ok ? '' : ` (expected ${JSON.stringify(want)})`}`)
}

/** Upload a sample as a supplier, read it, submit the fields exactly as read. */
async function submit(c: SupabaseClient, supplier: string, key: keyof typeof manifest) {
  const m = manifest[key]
  const path = `${party(supplier)}/${randomUUID()}.png`
  const up = await c.storage.from('invoices').upload(path, readFileSync(ROOT + 'samples/' + m.file), { contentType: 'image/png' })
  if (up.error) throw new Error(`upload ${key}: ${up.error.message}`)
  const ex = await fn(c, 'extract-invoice', { path, image_hash: m.image_hash })
  const res = await fn(c, 'run-checks', { invoice_id: ex.invoice_id, buyer_id: ex.buyer_id, fields: ex.fields })
  console.log(`${key}: source ${ex.source}, ${res.risk.summary}`)
  return { id: ex.invoice_id as string, source: ex.source as string, ...res }
}

const ravi = await as('ravi'), kaveri = await as('kaveri'), peacock = await as('peacock'), banyan = await as('banyan')
const lender = await as('lender'), auditor = await as('auditor')

const s5 = await submit(ravi, 'ravi', 'S5')
expect('S5 decision', [s5.decision, s5.risk.score, s5.credit.score], ['auto_approve', 0, 77])
const c5 = await fn(banyan, 'invoice-action', { invoice_id: s5.id, action: 'confirm' })
expect('S5 after Banyan confirms', c5.status, 'offer_released')
const { data: o5 } = await ravi.from('financing_offers').select('advance_amount, fee_amount').eq('invoice_id', s5.id).single()
expect('S5 offer', [Number(o5!.advance_amount), Number(o5!.fee_amount)], [66375, 1991.25])

const s3 = await submit(ravi, 'ravi', 'S3')
expect('S3 decision', [s3.decision, s3.risk.score, s3.risk.level], ['review', 18, 'MEDIUM'])

const s1 = await submit(ravi, 'ravi', 'S1')
expect('S1 decision', [s1.decision, s1.risk.score, s1.source], ['auto_approve', 0, 'cache'])
const c1 = await fn(peacock, 'invoice-action', { invoice_id: s1.id, action: 'confirm' })
expect('S1 after Peacock confirms', c1.message, 'Offer released: ₹2,04,000 advance (85%).')

const s2 = await submit(ravi, 'ravi', 'S2')
expect('S2 decision', [s2.decision, s2.risk.score, s2.source], ['reject', 60, 'reuse'])
const s6 = await submit(ravi, 'ravi', 'S6')
expect('S6 decision', [s6.decision, s6.risk.score], ['reject', 63])
const s4 = await submit(kaveri, 'kaveri', 'S4')
expect('S4 decision', [s4.decision, s4.risk.score, s4.credit.score], ['reject', 15, 93])

// Roles and RLS on real rows
expect('Kaveri sees Ravi invoices', (await kaveri.from('invoices').select('id').eq('supplier_id', party('ravi'))).data, [])
const signed = await kaveri.storage.from('invoices').createSignedUrl((await lender.from('invoices').select('file_path').eq('id', s1.id).single()).data!.file_path, 60)
expect("Kaveri can sign Ravi's file", Boolean(signed.data?.signedUrl), false)
expect('Banyan sees Peacock invoice', (await banyan.from('invoices').select('id').eq('id', s1.id)).data, [])
expect('Peacock confirms twice', await fn(peacock, 'invoice-action', { invoice_id: s1.id, action: 'confirm' }).catch((e) => e.message), 'invoice-action: This invoice is already closed.')
expect('Buyer approves', await fn(peacock, 'invoice-action', { invoice_id: s1.id, action: 'approve' }).catch((e) => e.message), "invoice-action: A buyer can't approve an invoice.")
expect('Supplier runs verify', await fn(ravi, 'verify-chain', {}).catch((e) => e.message), 'verify-chain: This action needs the lender or auditor role.')

// Lender approves S3 (100 billed, 80 delivered), then Banyan confirms → 75% offer
const a3 = await fn(lender, 'invoice-action', { invoice_id: s3.id, action: 'approve', note: 'Partial delivery accepted for the demo.' })
expect('S3 lender approve', a3.status, 'approved')
const b3 = await fn(banyan, 'invoice-action', { invoice_id: s3.id, action: 'confirm' })
expect('S3 after Banyan confirms', b3.status, 'offer_released')

const v = await fn(auditor, 'verify-chain', {})
expect('Verify chain (clean)', [v.ok, v.problems.length], [true, 0])
console.log(`  head #${v.head?.seq} ${v.head?.entry_hash.slice(0, 16)}… over ${v.count} entries`)
console.log(failures ? `\n${failures} expectation(s) failed.` : '\nAll expectations met.')
process.exit(failures ? 1 : 0)
