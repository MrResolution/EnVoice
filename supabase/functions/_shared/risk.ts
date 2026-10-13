// Transparent risk score: every point traces back to one row of the table the lender sees.
// The score explains and ranks; it never overrides a rule (a single fail still rejects, see decide.ts).

import type { Category, CheckResult, Status } from './types.ts'

export const WEIGHTS: Record<Category, number> = { three_way: 35, duplicates: 25, vendor_bank: 15, integrity: 15, behaviour: 10 }
export const LABELS: Record<Category, string> = {
  three_way: 'Three-way match', duplicates: 'Duplicates', vendor_bank: 'Vendor / bank', integrity: 'Document integrity', behaviour: 'Behaviour',
}
const FACTOR: Record<Status, number> = { pass: 0, warn: 0.5, fail: 1 }
const RANK: Record<Status, number> = { pass: 0, warn: 1, fail: 2 }
const worst = (xs: Status[]) => xs.reduce<Status>((w, s) => (RANK[s] > RANK[w] ? s : w), 'pass')

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type RiskRow = { category: Category; label: string; weight: number; status: Status; points: number; reasons: string[] }
export type Risk = { score: number; level: RiskLevel; breakdown: RiskRow[]; summary: string }

/** Lower-cases the first letter when joining sentences, unless it starts a code like "PO-4501". */
const join = (reasons: string[]) =>
  reasons.map((s) => s.replace(/\.$/, '')).map((s, i) => (i > 0 && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)).join('; ')

export function riskScore(results: CheckResult[]): Risk {
  const breakdown = (Object.keys(WEIGHTS) as Category[]).map((category) => {
    const rows = results.filter((x) => x.category === category)
    const status = worst(rows.map((x) => x.status))
    return { category, label: LABELS[category], weight: WEIGHTS[category], status, points: WEIGHTS[category] * FACTOR[status], reasons: rows.filter((x) => x.status !== 'pass').map((x) => x.reason) }
  })
  const score = Math.round(breakdown.reduce((s, b) => s + b.points, 0))
  const top = worst(results.map((x) => x.status))
  const level: RiskLevel = top === 'fail' || score >= 40 ? 'HIGH' : top === 'warn' ? 'MEDIUM' : 'LOW'
  // Fails first, then heavier categories, so the first words are the biggest problem.
  const problems = results.filter((x) => x.status !== 'pass')
    .sort((a, b) => RANK[b.status] - RANK[a.status] || WEIGHTS[b.category] - WEIGHTS[a.category])
  const summary = `Risk ${score}/100 — ${level}. ` + (problems.length ? join(problems.map((p) => p.reason)) + '.' : `All ${results.length} checks passed.`)
  return { score, level, breakdown, summary }
}
