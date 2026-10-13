// Shared by anchor.ts and verify.ts: the auditor's Supabase session, the local chain and the contract.
// The service-role key is never used here; the auditor can read the log and calls record-anchor like any client.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { ContractFactory, Contract, JsonRpcProvider, Interface } from 'ethers'

const ROOT = new URL('../../', import.meta.url).pathname
process.loadEnvFile(ROOT + '.env.local')

export const RPC = process.env.CHAIN_RPC ?? 'http://127.0.0.1:8545'
const DEPLOYMENT = new URL('../deployment.json', import.meta.url).pathname
const artifact = JSON.parse(readFileSync(new URL('../artifacts/contracts/AnchorRegistry.sol/AnchorRegistry.json', import.meta.url), 'utf8'))
export const iface = new Interface(artifact.abi)

export async function auditor() {
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { error } = await db.auth.signInWithPassword({ email: 'auditor@invoseal.test', password: process.env.DEMO_PASSWORD! })
  if (error) throw new Error(`Auditor sign-in failed: ${error.message}`)
  return db
}

export type Entry = { seq: number; entry_hash: string }
export async function entries(db: Awaited<ReturnType<typeof auditor>>, afterSeq = 0): Promise<Entry[]> {
  const out: Entry[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('audit_log').select('seq, entry_hash').gt('seq', afterSeq).order('seq').range(from, from + 999)
    if (error) throw new Error(`Reading the audit log: ${error.message}`)
    out.push(...(data as Entry[]))
    if (data.length < 1000) return out
  }
}

export async function provider() {
  const p = new JsonRpcProvider(RPC, undefined, { staticNetwork: true })
  try { await p.getBlockNumber() } catch { throw new Error(`No chain at ${RPC}. Start it with: npm --prefix chain run node`) }
  return p
}

/** The registry on this chain, deploying it if the chain is new (Hardhat's node starts empty every time). */
export async function registry(p: JsonRpcProvider) {
  const signer = await p.getSigner(0) // hardhat node unlocks its test accounts; no private key in this repo
  const chainId = Number((await p.getNetwork()).chainId)
  if (existsSync(DEPLOYMENT)) {
    const d = JSON.parse(readFileSync(DEPLOYMENT, 'utf8'))
    if (d.chainId === chainId && (await p.getCode(d.address)) !== '0x') return { contract: new Contract(d.address, artifact.abi, signer), address: d.address as string, chainId }
  }
  const c = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy()
  await c.waitForDeployment()
  const address = await c.getAddress()
  writeFileSync(DEPLOYMENT, JSON.stringify({ chainId, address, deployedAt: new Date().toISOString() }, null, 2) + '\n')
  console.log(`Deployed AnchorRegistry at ${address} (chain ${chainId}).`)
  return { contract: new Contract(address, artifact.abi, signer), address, chainId }
}

/** The root an anchor transaction wrote, read from its Anchored event. */
export async function rootFromTx(p: JsonRpcProvider, txHash: string, contract: string) {
  const r = await p.getTransactionReceipt(txHash)
  if (!r) return null
  const log = r.logs.find((l) => l.address.toLowerCase() === contract.toLowerCase())
  const ev = log ? iface.parseLog(log) : null
  return ev ? { root: (ev.args.root as string).slice(2), block: r.blockNumber } : null
}
