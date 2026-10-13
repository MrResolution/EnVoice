// Reads an anchored root straight from the chain with plain JSON-RPC (no web3 library).
// The chain is a local Hardhat node, so it is reachable from the anchor laptop (127.0.0.1:8545) or through a
// tunnel set in VITE_CHAIN_RPC. The public website on any other computer can't reach it, and says so plainly.

import { Capacitor } from '@capacitor/core'

const CONFIGURED = import.meta.env.VITE_CHAIN_RPC as string | undefined
export const RPC = CONFIGURED ?? 'http://127.0.0.1:8545'

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/
/** True when this page can talk to the chain: a tunnel is configured, or the page itself runs on the anchor laptop.
 *  (An https site calling http://127.0.0.1 is blocked as mixed content by Safari anyway.) */
export const chainReachableFromHere = () =>
  Boolean(CONFIGURED) || (!Capacitor.isNativePlatform() && LOOPBACK.test(window.location.hostname)) // the APK's page is "localhost" too, but on a phone

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json', 'ngrok-skip-browser-warning': '1' }, signal: AbortSignal.timeout(4000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const body = await res.json()
  if (body.error) throw new Error(body.error.message)
  return body.result as T
}

type Receipt = { status: string; blockNumber: string; logs: { address: string; data: string }[] } | null

export type OnChain =
  | { kind: 'ok'; root: string; block: number }
  | { kind: 'remote' } // public website: the local chain is only reachable on the anchor laptop
  | { kind: 'down' } // this is the anchor laptop but no node is running
  | { kind: 'missing' } // node running, but this transaction isn't on it (restarted, or anchored on another laptop)
  | { kind: 'no-event' }

/** The root written by the anchor transaction: event Anchored(uint256 indexed index, bytes32 root, uint64 fromSeq, uint64 toSeq). */
export async function onChainRoot(txHash: string, contract: string): Promise<OnChain> {
  if (!chainReachableFromHere()) return { kind: 'remote' }
  try {
    const r = await rpc<Receipt>('eth_getTransactionReceipt', [txHash])
    if (!r) return { kind: 'missing' }
    const log = r.logs.find((l) => l.address.toLowerCase() === contract.toLowerCase())
    if (r.status !== '0x1' || !log) return { kind: 'no-event' }
    return { kind: 'ok', root: log.data.slice(2, 66), block: parseInt(r.blockNumber, 16) }
  } catch {
    return { kind: 'down' }
  }
}
