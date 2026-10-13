// RLS against the hosted project: signs in as each demo user with the anon key, like the app does.
// Needs .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, DEMO_PASSWORD) and the seed applied.
// Run: npm run test:rls
import { beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import world from '../samples/world.json' with { type: 'json' }

process.loadEnvFile(new URL('../.env.local', import.meta.url).pathname)
const URL_ = process.env.VITE_SUPABASE_URL!, KEY = process.env.VITE_SUPABASE_ANON_KEY!, PW = process.env.DEMO_PASSWORD!
const party = (k: string) => world.parties.find((p) => p.key === k)!.id
const as: Record<string, SupabaseClient> = {}

async function signIn(user: string) {
  const c = createClient(URL_, KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: `${user}@invoseal.test`, password: PW })
  if (error) throw new Error(`${user}: ${error.message}`)
  return c
}

beforeAll(async () => {
  for (const u of ['ravi', 'kaveri', 'peacock', 'banyan', 'lender', 'auditor']) as[u] = await signIn(u)
})

/** A write that RLS/privileges must refuse: either an error or zero rows touched. */
async function refused(q: PromiseLike<{ error: unknown; data: unknown[] | null }>) {
  const { error, data } = await q
  return Boolean(error) || !data || data.length === 0
}

describe('allowed', () => {
  it('each user sees their own profile with the right role', async () => {
    const { data } = await as.ravi.from('profiles').select('role, party_id')
    expect(data).toEqual([{ role: 'supplier', party_id: party('ravi') }])
  })
  // Rules, not counts: people keep raising POs and signing up, so exact totals go stale.
  it('suppliers see their own POs only', async () => {
    const { data } = await as.ravi.from('purchase_orders').select('po_number, supplier_id')
    expect(data!.every((p) => p.supplier_id === party('ravi'))).toBe(true)
    expect(data!.map((p) => p.po_number)).toEqual(expect.arrayContaining(['PO-4501', 'PO-4502', 'PO-4504']))
  })
  it('buyers see POs raised by them and their receipts', async () => {
    const { data } = await as.banyan.from('purchase_orders').select('po_number, buyer_id, delivery_receipts(grn_number)')
    expect(data!.every((p) => p.buyer_id === party('banyan'))).toBe(true)
    expect(data!.map((p) => p.po_number)).toEqual(expect.arrayContaining(['PO-4502', 'PO-4504']))
  })
  it('lender sees every PO and every profile', async () => {
    const pos = (await as.lender.from('purchase_orders').select('buyer_id, supplier_id')).data!
    expect(new Set(pos.map((p) => p.buyer_id)).size).toBeGreaterThanOrEqual(2) // more than one buyer's POs
    expect(new Set(pos.map((p) => p.supplier_id)).size).toBeGreaterThanOrEqual(2)
    const roles = (await as.lender.from('profiles').select('role')).data!.map((p) => p.role)
    expect(roles).toEqual(expect.arrayContaining(['supplier', 'buyer', 'lender', 'auditor']))
  })
  it('auditor reads the audit log and anchors', async () => {
    expect((await as.auditor.from('audit_log').select('seq').limit(1)).error).toBeNull()
    expect((await as.auditor.from('anchors').select('batch_no')).error).toBeNull()
  })
  it('party names are readable (for lists)', async () => {
    const { data } = await as.peacock.from('parties').select('id, name')
    expect(data!.map((p) => p.name)).toEqual(expect.arrayContaining(world.parties.map((p) => p.name)))
  })
})

describe('denied', () => {
  it('Kaveri cannot read Ravi\'s invoices or POs', async () => {
    expect((await as.kaveri.from('invoices').select('id').eq('supplier_id', party('ravi'))).data).toEqual([])
    expect((await as.kaveri.from('purchase_orders').select('id').eq('supplier_id', party('ravi'))).data).toEqual([])
  })
  it('Banyan cannot read invoices raised on Peacock', async () => {
    expect((await as.banyan.from('invoices').select('id').eq('buyer_id', party('peacock'))).data).toEqual([])
  })
  it('suppliers and buyers cannot read the audit log', async () => {
    expect((await as.ravi.from('audit_log').select('seq')).data ?? []).toEqual([])
    expect((await as.peacock.from('audit_log').select('seq')).data ?? []).toEqual([])
  })
  it("nobody reads parties' bank accounts or credit data", async () => {
    expect((await as.ravi.from('parties').select('bank_account')).error).not.toBeNull()
    expect((await as.lender.from('parties').select('on_time_rate')).error).not.toBeNull()
  })
  it('nobody writes any table directly', async () => {
    expect(await refused(as.auditor.from('invoices').update({ amount: 1 }).neq('id', '00000000-0000-0000-0000-000000000000').select())).toBe(true)
    expect(await refused(as.ravi.from('audit_log').insert({ event_type: 'invoice_uploaded', payload: {}, payload_hash: 'x', prev_hash: 'x', entry_hash: 'x', ts: 'x' }).select())).toBe(true)
    expect(await refused(as.lender.from('audit_log').delete().gte('seq', 0).select())).toBe(true)
    expect(await refused(as.ravi.from('profiles').update({ role: 'lender' }).eq('id', world.users[0].id).select())).toBe(true)
    expect(await refused(as.peacock.from('parties').insert({ type: 'buyer', name: 'Fake' }).select())).toBe(true)
  })
  it('suppliers cannot upload into another supplier\'s folder', async () => {
    const { error } = await as.kaveri.storage.from('invoices').upload(`${party('ravi')}/rls-test.png`, new Blob(['x'], { type: 'image/png' }))
    expect(error).not.toBeNull()
  })
  it('buyers cannot upload at all', async () => {
    const { error } = await as.peacock.storage.from('invoices').upload(`${party('peacock')}/rls-test.png`, new Blob(['x'], { type: 'image/png' }))
    expect(error).not.toBeNull()
  })
  it("Kaveri cannot sign a URL for Ravi's file", async () => {
    const { data: files } = await as.lender.from('invoices').select('file_path').eq('supplier_id', party('ravi')).limit(1)
    const path = files?.[0]?.file_path ?? `${party('ravi')}/00000000-0000-4000-8000-000000000000.png`
    const { data, error } = await as.kaveri.storage.from('invoices').createSignedUrl(path, 60)
    expect(error ?? !data?.signedUrl).toBeTruthy()
  })
  it('anonymous visitors cannot write or wipe invoices', async () => {
    const anon = createClient(URL_, KEY, { auth: { persistSession: false } })
    expect(await refused(anon.from('invoices').update({ amount: 1 }).neq('id', '00000000-0000-0000-0000-000000000000').select())).toBe(true)
    expect(await refused(anon.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000').select())).toBe(true)
  })
  it('anonymous visitors see nothing', async () => {
    const anon = createClient(URL_, KEY, { auth: { persistSession: false } })
    expect((await anon.from('invoices').select('id')).data ?? []).toEqual([])
    expect((await anon.from('parties').select('name')).data ?? []).toEqual([])
  })
})
