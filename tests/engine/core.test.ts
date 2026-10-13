// Normalisation, audit chain and Merkle maths.
import { describe, expect, it } from 'vitest'
import { currency, isoDate, lookalike, money, name } from '../../supabase/functions/_shared/normalize.ts'
import { editedFields } from '../../supabase/functions/_shared/checks.ts'
import { canon } from '../../supabase/functions/_shared/canon.ts'
import { describeChanges, entryHash, GENESIS, payloadHash, recordHash, verifyEntries, type Entry, type Payload } from '../../supabase/functions/_shared/audit.ts'
import { merkleProof, merkleRoot, verifyProof } from '../../supabase/functions/_shared/merkle.ts'
import { invoiceFor } from './world.ts'

describe('normalize', () => {
  it('money', () => {
    expect(['₹1,00,000', 'Rs. 1,00,000.00/-', '100000', 100000, 'INR 100000'].map(money)).toEqual(Array(5).fill(100000))
    expect(money('abc')).toBeNull()
  })
  it('dates are day-first', () => {
    expect(['10/10/2026', '10-Oct-2026', '10 October 2026', 'Oct 10, 2026', '2026-10-10'].map(isoDate)).toEqual(Array(5).fill('2026-10-10'))
    expect(isoDate('31/02/2026')).toBeNull()
  })
  it('names, numbers, currency', () => {
    expect(name('M/s Ravi Plastics Pvt. Ltd.')).toBe('ravi plastics')
    expect(lookalike('inv-1O01')).toBe(lookalike('INV 1001'))
    expect(currency('Rs.')).toBe('INR')
  })
  it('editedFields ignores formatting, catches real changes', () => {
    const ai = invoiceFor('S1')
    expect(editedFields(ai, { ...ai, amount: 240000.0, invoice_no: 'inv 1001' })).toEqual([])
    expect(editedFields(ai, { ...ai, amount: 264000, bank_account: '1111' })).toEqual(['amount', 'bank_account'])
  })
})

async function chain(n: number): Promise<Entry[]> {
  const out: Entry[] = []
  let prev = GENESIS
  for (let seq = 1; seq <= n; seq++) {
    const payload: Payload = { invoice_id: 'i1', file_hash: null, record_hash: null, summary: `step ${seq}` }
    const ts = `2026-10-13T05:00:0${seq}.000Z`
    const ph = await payloadHash(payload)
    const eh = await entryHash(prev, 'checks_completed', ph, ts)
    out.push({ seq, invoice_id: 'i1', event_type: 'checks_completed', payload, payload_hash: ph, prev_hash: prev, entry_hash: eh, ts })
    prev = eh
  }
  return out
}

describe('audit chain', () => {
  it('intact chain verifies', async () => expect(await verifyEntries(await chain(5))).toBeNull())
  it('edited entry is caught at that entry', async () => {
    const c = await chain(5); c[2].payload = { ...c[2].payload, summary: 'edited' }
    expect(await verifyEntries(c)).toMatchObject({ seq: 3, kind: 'edited' })
  })
  it('deleted entry breaks the next link', async () => {
    const c = await chain(5); c.splice(2, 1)
    expect(await verifyEntries(c)).toMatchObject({ seq: 4, kind: 'broken_link' })
  })
  it('reordered entries break the chain', async () => {
    const c = await chain(5); [c[1], c[2]] = [c[2], c[1]]
    expect(await verifyEntries(c)).not.toBeNull()
  })
  it('record hash ignores number formatting; changes are named', async () => {
    const inv = invoiceFor('S5') as unknown as Record<string, unknown>
    expect(await recordHash(inv)).toBe(await recordHash({ ...inv, amount: '88500.00' }))
    expect(describeChanges({ ...inv, amount: 885000 }, inv)).toBe(': amount ₹88,500 → ₹8,85,000')
  })
  it('canon sorts keys', () => expect(canon({ b: 1, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":1}'))
})

describe('merkle', () => {
  it('proofs verify for every leaf; a changed leaf does not', async () => {
    const leaves = (await chain(5)).map((e) => e.entry_hash)
    const root = await merkleRoot(leaves)
    for (let i = 0; i < leaves.length; i++) expect(await verifyProof(leaves[i], await merkleProof(leaves, i), root)).toBe(true)
    expect(await verifyProof('0'.repeat(64), await merkleProof(leaves, 0), root)).toBe(false)
    expect(await merkleRoot([leaves[0]])).toBe(leaves[0])
  })
})
