// Decision rules. Deterministic: the same checks always give the same decision.
// Rules first, score second: a fail rejects no matter how good the rest looks.

import type { CheckResult } from './types.ts'
import type { Credit } from './credit.ts'
import { daysBetween, round2 } from './normalize.ts'

export type Decision = 'auto_approve' | 'review' | 'reject'

/** Advance moves with the buyer's credit. Below 70 a human decides; 65% is only a suggestion. */
export const advancePct = (credit: number) => (credit >= 80 ? 85 : credit >= 70 ? 75 : 65)

export function decide(results: CheckResult[], credit: Credit, buyerStatus: 'pending' | 'confirmed' | 'disputed' = 'pending') {
  const fails = results.filter((x) => x.status === 'fail')
  if (fails.length) return { decision: 'reject' as Decision, advancePct: 0, reasons: fails.map((x) => x.reason) }
  const reasons = results.filter((x) => x.status === 'warn').map((x) => x.reason) // low AI confidence is one of these
  if (credit.score < 70) reasons.push(`Buyer credit is ${credit.score}, below the 70 needed for automatic approval.`)
  if (buyerStatus === 'disputed') reasons.push('The buyer disputed this invoice.')
  const pct = advancePct(credit.score)
  if (reasons.length) return { decision: 'review' as Decision, advancePct: pct, reasons }
  return { decision: 'auto_approve' as Decision, advancePct: pct, reasons: [`Every check passed and buyer credit is ${credit.score}: ${pct}% advance once the buyer confirms.`] }
}

/** Mock pricing: 1.5% of the advance for every started 30 days until the due date. */
export function offerTerms(amount: number, pct: number, invoiceDate: string, dueDate: string) {
  const advance = round2((amount * pct) / 100)
  const months = Math.max(1, Math.ceil(daysBetween(invoiceDate, dueDate) / 30))
  return { advance, months, fee: round2(advance * 0.015 * months) }
}
