// npm --prefix chain run verify
// For every anchored batch: the root on-chain, the root stored in the DB, and a fresh root from today's entries
// must all be equal. A consistent rewrite of the log changes the fresh root, which the chain then contradicts.
import { merkleRoot } from '../../supabase/functions/_shared/merkle.ts'
import { auditor, entries, provider, rootFromTx } from './lib.ts'

const db = await auditor()
const { data: anchors, error } = await db.from('anchors').select('*').order('batch_no')
if (error) throw new Error(error.message)
if (!anchors.length) { console.log('No batches anchored yet. Run: npm --prefix chain run anchor'); process.exit(0) }

const all = await entries(db)
const p = await provider()
let bad = 0
for (const a of anchors) {
  const leaves = all.filter((e) => e.seq >= a.from_seq && e.seq <= a.to_seq).map((e) => e.entry_hash)
  const fresh = leaves.length ? await merkleRoot(leaves) : null
  const chain = await rootFromTx(p, a.tx_hash, a.contract_address)
  const problems = [
    !chain && 'anchor transaction not found on this chain (restarted? see docs/demo.md)',
    chain && chain.root !== a.merkle_root && `stored root differs from the on-chain root (block ${chain.block})`,
    fresh !== a.merkle_root && 'the log entries no longer produce the anchored root',
    leaves.length !== a.leaf_count && `${a.leaf_count} entries were anchored, ${leaves.length} remain`,
  ].filter(Boolean)
  if (problems.length) bad++
  console.log(`${problems.length ? '✗' : '✓'} Batch #${a.batch_no} entries #${a.from_seq}–#${a.to_seq} root ${a.merkle_root.slice(0, 12)}…${problems.length ? '\n    ' + problems.join('\n    ') : ' matches on-chain'}`)
}
console.log(bad ? `\n${bad} batch(es) failed.` : `\nAll ${anchors.length} batch(es) match the chain.`)
process.exit(bad ? 1 : 0)
