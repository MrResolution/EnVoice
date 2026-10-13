// Buyer credit: "will the buyer pay?". Kept separate from invoice risk ("is the invoice genuine?")
// because they answer different lender questions. Higher is safer.

import type { Party } from './types.ts'

export type Credit = { score: number; newBuyer: boolean; parts: { payment: number; delay: number; utilisation: number }; reason: string }

const one = (n: number) => Math.round(n * 10) / 10
const pct0 = (x: number) => `${Math.round(x * 100)}%`

export function buyerCredit(b: Pick<Party, 'on_time_rate' | 'avg_delay_days' | 'outstanding' | 'credit_limit'>): Credit {
  const newBuyer = b.on_time_rate === null || b.on_time_rate === undefined
  // A buyer we've never seen pay is treated as average, then capped: no history, no top score.
  const onTime = newBuyer ? 0.5 : Number(b.on_time_rate)
  const delay = newBuyer ? 0 : Number(b.avg_delay_days)
  const used = b.credit_limit > 0 ? Number(b.outstanding) / Number(b.credit_limit) : 1
  const parts = { payment: one(50 * onTime), delay: one(25 * Math.max(0, 1 - delay / 30)), utilisation: one(25 * Math.max(0, 1 - used)) }
  const raw = Math.round(50 * onTime + 25 * Math.max(0, 1 - delay / 30) + 25 * Math.max(0, 1 - used))
  const score = newBuyer ? Math.min(60, raw) : raw
  const reason = newBuyer
    ? `New buyer with no payment history, so the score is capped at 60.`
    : `Pays on time ${pct0(onTime)} of the time (${parts.payment}/50), ${delay} days late on average (${parts.delay}/25), using ${pct0(used)} of its credit limit (${parts.utilisation}/25).`
  return { score, newBuyer, parts, reason }
}
