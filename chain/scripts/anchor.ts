// npm --prefix chain run anchor
// Takes every audit entry after the last anchored batch, builds the Merkle root, writes it on-chain,
// then calls record-anchor, which recomputes the root from the DB before storing the batch.
import { merkleRoot } from '../../supabase/functions/_shared/merkle.ts'
import { auditor, entries, provider, registry } from './lib.ts'

const db = await auditor()
const { data: last } = await db.from('anchors').select('batch_no, to_seq').order('batch_no', { ascending: false }).limit(1).maybeSingle()
const batch = await entries(db, last?.to_seq ?? 0)
if (!batch.length) {
  console.log(`Nothing to anchor: every entry up to #${last?.to_seq ?? 0} is already in a batch.`)
  process.exit(0)
}

const root = await merkleRoot(batch.map((e) => e.entry_hash))
const fromSeq = batch[0].seq, toSeq = batch.at(-1)!.seq
const p = await provider()
const { contract, address, chainId } = await registry(p)
const tx = await contract.anchor('0x' + root, fromSeq, toSeq)
const receipt = await tx.wait()

const { data, error } = await db.functions.invoke('record-anchor', {
  body: { from_seq: fromSeq, to_seq: toSeq, merkle_root: root, chain_id: chainId, contract_address: address, tx_hash: receipt.hash, block_number: receipt.blockNumber },
})
if (error) {
  const msg = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => null)
  console.error(`On-chain write succeeded (tx ${receipt.hash}) but record-anchor refused: ${msg ?? error.message}`)
  process.exit(1)
}
console.log(`Batch #${data.batch_no}: entries #${fromSeq}–#${toSeq} (${batch.length} leaves)`)
console.log(`  root  ${root}`)
console.log(`  block ${receipt.blockNumber} · tx ${receipt.hash}`)
