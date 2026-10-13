// Audit chain maths (pure). Writing to the DB lives in db.ts; this file is shared with tests and scripts.
// entry_hash = SHA256(prev_hash + event_type + payload_hash + ts), so changing, removing or moving
// any entry breaks the link to the next one.

import { canon, sha256 } from './canon.ts'
import { inr } from './normalize.ts'

export const GENESIS = '0'.repeat(64)
export const EVENTS = ['invoice_uploaded', 'fields_extracted', 'checks_completed', 'decision_made', 'buyer_confirmed', 'buyer_disputed', 'offer_released'] as const

export type Payload = { invoice_id: string | null; file_hash: string | null; record_hash: string | null; summary: string }
export type Entry = { seq: number; invoice_id: string | null; event_type: string; payload: Payload; payload_hash: string; prev_hash: string; entry_hash: string; ts: string }

/** The invoice fields that matter for financing. Status is left out: it changes by design and each change is its own event. */
const RECORD_FIELDS = ['id', 'supplier_id', 'buyer_id', 'invoice_no', 'invoice_date', 'due_date', 'vendor_name', 'po_number',
  'currency', 'subtotal', 'tax_amount', 'amount', 'bank_account', 'line_items', 'file_hash'] as const
const MONEY = new Set(['subtotal', 'tax_amount', 'amount'])
const fixed = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v).toFixed(2))

/** Stable view of an invoice row: money as 2-decimal strings, so 240000 and "240000.00" hash the same. */
export function recordView(inv: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of RECORD_FIELDS) {
    const v = inv[f]
    if (MONEY.has(f)) out[f] = fixed(v)
    else if (f === 'line_items') out[f] = ((v as Record<string, unknown>[] | null) ?? []).map((l) => ({
      description: l.description ?? null, hsn: l.hsn ?? null, qty: fixed(l.qty), unit_price: fixed(l.unit_price), amount: fixed(l.amount),
    }))
    else out[f] = v ?? null
  }
  return out
}

export const recordHash = (inv: Record<string, unknown>) => sha256(canon(recordView(inv)))
export const payloadHash = (p: Payload) => sha256(canon(p))
export const entryHash = (prevHash: string, eventType: string, pHash: string, ts: string) => sha256(prevHash + eventType + pHash + ts)

export type Break = { seq: number; kind: 'edited' | 'broken_link'; message: string }

/** Walks the entries in seq order and returns the first break. Gaps in seq are fine: a failed insert burns one. */
export async function verifyEntries(entries: Entry[]): Promise<Break | null> {
  let prev = GENESIS
  let prevSeq: number | null = null
  for (const e of entries) {
    const pOk = (await payloadHash(e.payload)) === e.payload_hash
    const eOk = (await entryHash(e.prev_hash, e.event_type, e.payload_hash, e.ts)) === e.entry_hash
    if (!pOk || !eOk) return { seq: e.seq, kind: 'edited', message: `Entry #${e.seq} was changed after it was written.` }
    if (e.prev_hash !== prev) {
      const message = prevSeq === null
        ? `Entry #${e.seq} isn't linked to the start of the chain: earlier entries were removed.`
        : `Entry #${e.seq} doesn't follow #${prevSeq}: an entry was removed or moved.`
      return { seq: e.seq, kind: 'broken_link', message }
    }
    prev = e.entry_hash
    prevSeq = e.seq
  }
  return null
}

/** Latest recorded record_hash and file_hash per invoice, with the entry that recorded them. */
export function latestRecorded(entries: Entry[]) {
  const out = new Map<string, { recordSeq?: number; record?: string; fileSeq?: number; file?: string }>()
  for (const e of entries) {
    if (!e.invoice_id) continue
    const cur = out.get(e.invoice_id) ?? {}
    if (e.payload.record_hash) { cur.record = e.payload.record_hash; cur.recordSeq = e.seq }
    if (e.payload.file_hash) { cur.file = e.payload.file_hash; cur.fileSeq = e.seq }
    out.set(e.invoice_id, cur)
  }
  return out
}

/** Names what changed, using the snapshot taken when the record hash was written. The hash is the evidence;
 *  the snapshot only makes the message readable ("amount ₹88,500 → ₹8,85,000"). */
export function describeChanges(now: Record<string, unknown>, snapshot: Record<string, unknown> | null): string {
  if (!snapshot) return ''
  const a = recordView(snapshot), b = recordView(now)
  const changed = Object.keys(b).filter((k) => canon(a[k]) !== canon(b[k]))
  if (!changed.length) return ''
  return ': ' + changed.map((k) => (MONEY.has(k) ? `${k.replace('_', ' ')} ${inr(Number(a[k]))} → ${inr(Number(b[k]))}` : `${k.replace('_', ' ')} changed`)).join(', ')
}
