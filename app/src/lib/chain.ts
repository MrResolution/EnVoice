// Reads an anchored root straight from the chain with plain JSON-RPC (no web3 library).
// Works where the local Hardhat node is reachable: the anchor laptop at 127.0.0.1:8545.

export const RPC = (import.meta.env.VITE_CHAIN_RPC as string | undefined) ?? 'http://127.0.0.1:8545'

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(4000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const body = await res.json()
  if (body.error) throw new Error(body.error.message)
  return body.result as T
}

type Receipt = { status: string; blockNumber: string; logs: { address: string; data: string }[] } | null

/** The root written by the anchor transaction: event Anchored(uint256 indexed index, bytes32 root, uint64 fromSeq, uint64 toSeq). */
export async function onChainRoot(txHash: string, contract: string): Promise<{ root: string; block: number } | { error: string }> {
  try {
    const r = await rpc<Receipt>('eth_getTransactionReceipt', [txHash])
    if (!r) return { error: 'Transaction not on this chain (was the local chain restarted? run the anchor script again).' }
    const log = r.logs.find((l) => l.address.toLowerCase() === contract.toLowerCase())
    if (r.status !== '0x1' || !log) return { error: 'The anchor transaction has no Anchored event.' }
    return { root: log.data.slice(2, 66), block: parseInt(r.blockNumber, 16) }
  } catch {
    return { error: `Can't reach the chain at ${RPC}. Run \`npm --prefix chain run node\` on this machine.` }
  }
}
