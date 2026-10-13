// Walks the whole audit chain and checks the four tamper types: edited entry, removed/moved entry,
// changed invoice row, swapped file. Then recomputes every anchored batch root. The on-chain comparison
// happens where the chain is reachable (anchor laptop: auditor screen or `npm --prefix chain run verify`).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3'
import { fileHash, handle } from '../_shared/db.ts'
import { describeChanges, latestRecorded, recordHash, verifyEntries, type Entry } from '../_shared/audit.ts'
import { merkleRoot } from '../_shared/merkle.ts'

export type Problem = { kind: 'edited' | 'broken_link' | 'record' | 'file' | 'batch'; seq?: number; invoice_id?: string; message: string }

handle(['lender', 'auditor'], async (_body, _caller, db) => {
  const entries = await allEntries(db)
  const problems: Problem[] = []

  const brk = await verifyEntries(entries)
  if (brk) problems.push({ kind: brk.kind, seq: brk.seq, message: brk.message })

  const recorded = latestRecorded(entries)
  const ids = [...recorded.keys()]
  const { data: rows } = ids.length ? await db.from('invoices').select('*').in('id', ids) : { data: [] }
  for (const [id, rec] of recorded) {
    const row = rows?.find((r) => r.id === id)
    const label = row?.invoice_no ?? 'An invoice'
    if (!row) { problems.push({ kind: 'record', invoice_id: id, message: `${label} recorded in the chain no longer exists.` }); continue }
    if (rec.record && rec.record !== await recordHash(row)) {
      problems.push({ kind: 'record', seq: rec.recordSeq, invoice_id: id,
        message: `${label} changed after entry #${rec.recordSeq}${describeChanges(row, row.recorded_fields)}.` })
    }
    if (rec.file && rec.file !== await fileHash(db, row.file_path)) {
      problems.push({ kind: 'file', seq: rec.fileSeq, invoice_id: id, message: `The file for ${label} is not the file that was uploaded.` })
    }
  }

  const { data: anchors } = await db.from('anchors').select('*').order('batch_no')
  const batches = []
  for (const a of anchors ?? []) {
    const leaves = entries.filter((e) => e.seq >= a.from_seq && e.seq <= a.to_seq).map((e) => e.entry_hash)
    const root = leaves.length ? await merkleRoot(leaves) : null
    const ok = root === a.merkle_root && leaves.length === a.leaf_count
    if (!ok) problems.push({ kind: 'batch', message: `Batch #${a.batch_no} (entries #${a.from_seq}–#${a.to_seq}) no longer matches its anchored root.` })
    batches.push({ ...a, recomputed_root: root, matches_db: ok })
  }

  const head = entries.at(-1)
  return {
    ok: problems.length === 0, problems, batches,
    count: entries.length, head: head ? { seq: head.seq, entry_hash: head.entry_hash, ts: head.ts } : null,
    checked_at: new Date().toISOString(),
  }
})

async function allEntries(db: SupabaseClient): Promise<Entry[]> {
  const out: Entry[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('audit_log').select('*').order('seq').range(from, from + 999)
    if (error) throw new Error(`audit read: ${error.message}`)
    out.push(...(data as Entry[]))
    if (data.length < 1000) return out
  }
}
