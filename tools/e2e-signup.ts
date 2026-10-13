// End-to-end for brand-new accounts: email sign-up → onboarding → buyer raises a PO and records the delivery →
// seller uploads and submits an invoice typed by hand → lender reviews (new buyer, credit capped at 60) → buyer
// confirms → offer released → seller accepts. Run: node tools/e2e-signup.ts  (creates two *.test users)
import { randomUUID } from 'node:crypto'
import { crc32 } from 'node:zlib'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname)
const URL_ = process.env.VITE_SUPABASE_URL!, KEY = process.env.VITE_SUPABASE_ANON_KEY!
const client = () => createClient(URL_, KEY, { auth: { persistSession: false } })
let failures = 0
const expect = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failures++
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}: ${JSON.stringify(got)}${ok ? '' : ` (expected ${JSON.stringify(want)})`}`)
}
async function fn(c: SupabaseClient, name: string, body: Record<string, unknown>) {
  const { data, error } = await c.functions.invoke(name, { body })
  if (error) {
    const msg = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => null)
    throw new Error(`${name}: ${msg ?? error.message}`)
  }
  return data
}
async function signUp(tag: string) {
  const c = client()
  const email = `qa-${Date.now()}@${tag}-qa.test` // separate domains: a shared one is flagged as self-dealing
  const { data, error } = await c.auth.signUp({ email, password: randomUUID() })
  if (error || !data.session) throw new Error(`sign-up ${tag}: ${error?.message ?? 'no session (email confirmation still on?)'}`)
  return c
}
// A blank 1×1 PNG with a unique text chunk: nothing to read (typed by hand) and never a duplicate of a previous run.
const BASE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const chunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type), data]), len = Buffer.alloc(4), crc = Buffer.alloc(4)
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const PNG = Buffer.concat([BASE.subarray(0, BASE.length - 12), chunk('tEXt', Buffer.from(`run\0${randomUUID()}`)), BASE.subarray(BASE.length - 12)])

const buyer = await signUp('buyer'), seller = await signUp('seller')
const lender = client()
await lender.auth.signInWithPassword({ email: 'lender@invoseal.test', password: process.env.DEMO_PASSWORD! })

const b = await fn(buyer, 'onboard', { role: 'buyer', business_name: 'QA Mart', bank_account: '5550 1111 2222', city: 'Chennai' })
const s = await fn(seller, 'onboard', { role: 'supplier', business_name: 'QA Packaging', gstin: '33AAACQ1234F1Z5', bank_account: '5550 3333 4444', city: 'Coimbatore' })
expect('onboarded', [b.role, s.role], ['buyer', 'supplier'])
expect('onboard twice', await fn(seller, 'onboard', { role: 'buyer' }).catch((e) => e.message), 'onboard: Your account is already set up.')
expect('seller cannot raise a PO', await fn(seller, 'orders', { action: 'create_po' }).catch((e) => e.message), 'orders: This action needs the buyer role.')

const po = await fn(buyer, 'orders', { action: 'create_po', supplier_id: s.party_id, po_number: 'po-77', item: 'Corrugated boxes 5-ply', qty: 1200, unit_price: 32.5, tax_rate: 18 })
expect('PO total', [po.po_number, Number(po.total)], ['PO-77', 46020])
const grn = await fn(buyer, 'orders', { action: 'record_delivery', po_id: po.id, qty_delivered: 1200 })
expect('delivery recorded', typeof grn.grn_number, 'string')

const path = `${s.party_id}/${randomUUID()}.png`
const up = await seller.storage.from('invoices').upload(path, PNG, { contentType: 'image/png' })
if (up.error) throw new Error(up.error.message)
const ex = await fn(seller, 'extract-invoice', { path })
expect('blank file: nothing read, typed by hand', ex.source, 'manual')
const res = await fn(seller, 'run-checks', { invoice_id: ex.invoice_id, buyer_id: b.party_id, fields: {
  invoice_no: 'QA-001', invoice_date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10),
  vendor_name: 'QA Packaging', vendor_gstin: '33AAACQ1234F1Z5', buyer_name: 'QA Mart', po_number: 'PO-77', currency: 'INR',
  subtotal: 39000, tax_amount: 7020, amount: 46020, bank_account: '555033334444',
  line_items: [{ description: 'Corrugated boxes 5-ply', qty: 1200, unit_price: 32.5, amount: 39000 }] } })
console.log(`  ${res.risk.summary}`)
expect('new buyer → review (manual entry warns, credit 60)', [res.decision, res.credit.score], ['review', 60])
expect('fails', res.risk.breakdown.filter((x: { status: string }) => x.status === 'fail').length, 0)

expect('lender approves', (await fn(lender, 'invoice-action', { invoice_id: ex.invoice_id, action: 'approve' })).status, 'approved')
const conf = await fn(buyer, 'invoice-action', { invoice_id: ex.invoice_id, action: 'confirm' })
expect('buyer confirms → released', conf.status, 'offer_released')
const acc = await fn(seller, 'invoice-action', { invoice_id: ex.invoice_id, action: 'accept' })
expect('seller accepts', acc.message.startsWith('Accepted.'), true)
const { data: offer } = await seller.from('financing_offers').select('advance_pct, advance_amount, status').eq('invoice_id', ex.invoice_id).single()
expect('offer', [offer!.advance_pct, Number(offer!.advance_amount), offer!.status], [65, 29913, 'accepted'])
expect('anonymous visitor sees nothing', (await client().from('invoices').select('id').eq('id', ex.invoice_id)).data ?? [], [])

console.log(failures ? `\n${failures} expectation(s) failed.` : '\nAll expectations met.')
process.exit(failures ? 1 : 0)
