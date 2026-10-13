// The anchor script (signed in as the auditor) calls this after writing a Merkle root on-chain.
// The root is recomputed from the DB here, so a script can't store a root the log doesn't support.

import { handle, HttpError, must } from '../_shared/db.ts'
import { merkleRoot } from '../_shared/merkle.ts'

handle(['auditor'], async (body, caller, db) => {
  const from_seq = Number(body.from_seq), to_seq = Number(body.to_seq)
  const root = String(body.merkle_root ?? '').replace(/^0x/, '').toLowerCase()
  const tx_hash = String(body.tx_hash ?? ''), contract_address = String(body.contract_address ?? '')
  if (!Number.isInteger(from_seq) || !Number.isInteger(to_seq) || from_seq > to_seq) throw new HttpError(400, 'Bad sequence range.')
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx_hash) || !/^0x[0-9a-fA-F]{40}$/.test(contract_address)) throw new HttpError(400, 'Bad transaction or contract address.')

  const { data: last } = await db.from('anchors').select('batch_no, to_seq').order('batch_no', { ascending: false }).limit(1).maybeSingle()
  if (last && from_seq <= last.to_seq) throw new HttpError(409, `Entries up to #${last.to_seq} are already anchored.`)

  const rows = await must(db.from('audit_log').select('seq, entry_hash').gte('seq', from_seq).lte('seq', to_seq).order('seq'), 'Entries')
  if (!rows.length) throw new HttpError(400, 'No entries in that range.')
  const fresh = await merkleRoot(rows.map((r) => r.entry_hash))
  if (fresh !== root) throw new HttpError(409, "That root doesn't match the entries in the database.")

  const batch_no = (last?.batch_no ?? 0) + 1
  await must(db.from('anchors').insert({
    batch_no, from_seq, to_seq, leaf_count: rows.length, merkle_root: root,
    chain_id: Number(body.chain_id), contract_address, tx_hash, block_number: Number(body.block_number), anchored_by: caller.id,
  }).select('batch_no').single(), 'Anchor')
  return { batch_no, leaf_count: rows.length, merkle_root: root }
})
