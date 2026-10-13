// Merkle tree over audit entry hashes. The root is the only thing that goes on-chain: one 32-byte
// commitment proves a whole batch, and a short proof shows one entry is inside it without revealing the rest.

import { sha256 } from './canon.ts'

export type ProofStep = { sibling: string; side: 'left' | 'right' }

/** Parent = SHA256(left + right) over hex strings; an odd node moves up unchanged. */
async function nextLevel(level: string[]): Promise<string[]> {
  const next: string[] = []
  for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? await sha256(level[i] + level[i + 1]) : level[i])
  return next
}

export async function merkleRoot(leaves: string[]): Promise<string> {
  if (!leaves.length) throw new Error('A batch needs at least one entry.')
  let level = leaves
  while (level.length > 1) level = await nextLevel(level)
  return level[0]
}

export async function merkleProof(leaves: string[], index: number): Promise<ProofStep[]> {
  const proof: ProofStep[] = []
  let level = leaves, i = index
  while (level.length > 1) {
    const sib = i % 2 === 0 ? i + 1 : i - 1
    if (sib < level.length) proof.push({ sibling: level[sib], side: i % 2 === 0 ? 'right' : 'left' })
    level = await nextLevel(level)
    i = Math.floor(i / 2)
  }
  return proof
}

export async function verifyProof(leaf: string, proof: ProofStep[], root: string): Promise<boolean> {
  let h = leaf
  for (const step of proof) h = step.side === 'right' ? await sha256(h + step.sibling) : await sha256(step.sibling + h)
  return h === root
}
