// The 6 demo samples, submitted in demo order, must give exactly the results in docs/checks.md.
import { describe, expect, it } from 'vitest'
import { runChecks } from '../../supabase/functions/_shared/checks.ts'
import { riskScore } from '../../supabase/functions/_shared/risk.ts'
import { buyerCredit } from '../../supabase/functions/_shared/credit.ts'
import { decide, offerTerms } from '../../supabase/functions/_shared/decide.ts'
import type { Invoice } from '../../supabase/functions/_shared/types.ts'
import { ctxFor, invoiceFor, parties } from './world.ts'

const STATUS = { reject: 'rejected', review: 'review', auto_approve: 'offer_released' } as const
const done: Invoice[] = []

function submit(key: string, day: string) {
  const inv = invoiceFor(key, `2026-10-${day}T05:00:00Z`)
  const ctx = ctxFor(inv, [...done])
  const results = runChecks(ctx)
  const risk = riskScore(results)
  const credit = buyerCredit(ctx.buyer!)
  const d = decide(results, credit)
  done.push({ ...inv, status: STATUS[d.decision] })
  const notPass = (s: 'warn' | 'fail') => results.filter((x) => x.status === s).map((x) => x.name)
  return { results, risk, credit, d, warns: notPass('warn'), fails: notPass('fail') }
}

describe('demo samples in order', () => {
  it('S5 clean → auto-approve at 75% (Banyan credit 77)', () => {
    const s = submit('S5', '02')
    expect(s.fails).toEqual([]); expect(s.warns).toEqual([])
    expect(s.risk).toMatchObject({ score: 0, level: 'LOW' })
    expect(s.credit.score).toBe(77)
    expect(s.d).toMatchObject({ decision: 'auto_approve', advancePct: 75 })
    expect(offerTerms(88500, 75, '2026-10-02', '2026-11-16')).toEqual({ advance: 66375, months: 2, fee: 1991.25 })
  })

  it('S3 billed 100, delivered 80 → review, risk 18 MEDIUM', () => {
    const s = submit('S3', '11')
    expect(s.fails).toEqual([]); expect(s.warns).toEqual(['Quantity vs delivered'])
    expect(s.results.find((x) => x.name === 'Quantity vs delivered')!.reason).toContain('+25%')
    expect(s.risk).toMatchObject({ score: 18, level: 'MEDIUM' })
    expect(s.d.decision).toBe('review')
  })

  it('S1 clean → auto-approve at 85% = ₹2,04,000', () => {
    const s = submit('S1', '13')
    expect(s.fails).toEqual([]); expect(s.warns).toEqual([])
    expect(s.risk.summary).toBe('Risk 0/100 — LOW. All 21 checks passed.')
    expect(s.credit.score).toBe(97)
    expect(s.d).toMatchObject({ decision: 'auto_approve', advancePct: 85 })
    expect(offerTerms(240000, 85, '2026-10-10', '2026-12-09')).toEqual({ advance: 204000, months: 2, fee: 6120 })
  })

  it('S2 exact copy of S1 → reject, risk 60', () => {
    const s = submit('S2', '13')
    expect(s.fails.sort()).toEqual(['PO balance', 'Same file', 'Same invoice number'])
    expect(s.risk).toMatchObject({ score: 60, level: 'HIGH' })
    expect(s.d.decision).toBe('reject')
  })

  it('S6 edited copy → reject, risk 63 with four explained problems', () => {
    const s = submit('S6', '13')
    expect(s.fails.sort()).toEqual(['Amount vs PO', 'PO balance'])
    expect(s.warns.sort()).toEqual(['Bank account', 'Near-duplicate', 'Totals add up'])
    expect(s.risk).toMatchObject({ score: 63, level: 'HIGH' })
    expect(s.risk.summary).toMatch(/^Risk 63\/100 — HIGH\. Rs|^Risk 63\/100 — HIGH\. ₹2,46,000 exceeds PO-4501/)
    expect(s.risk.summary).toContain('looks like INV-1001')
    expect(s.risk.summary).toContain('••9911')
    expect(s.d.decision).toBe('reject')
  })

  it('S4 shared bank account → reject even with credit 93', () => {
    const s = submit('S4', '09')
    expect(s.fails).toEqual(['Self-dealing'])
    expect(s.results.find((x) => x.name === 'Self-dealing')!.reason).toContain('bank account ••7788')
    expect(s.risk).toMatchObject({ score: 15, level: 'HIGH' })
    expect(s.credit.score).toBe(93)
    expect(s.d.decision).toBe('reject')
  })
})

describe('buyer credit', () => {
  it('matches the seed table', () => {
    const score = (k: string) => buyerCredit(parties.get(k)!).score
    expect([score('peacock'), score('banyan'), score('lotus'), score('newleaf'), score('kaveri_retail')]).toEqual([97, 77, 35, 60, 93])
    expect(buyerCredit(parties.get('newleaf')!).newBuyer).toBe(true)
  })
})

describe('single checks', () => {
  const s1Active = () => [invoiceFor('S1', '2026-10-13T05:00:00Z', { status: 'offer_released' })]
  const names = (inv: Invoice, others: Invoice[] = []) =>
    Object.fromEntries(runChecks(ctxFor(inv, others)).filter((x) => x.status !== 'pass').map((x) => [x.name, x.status]))

  it('look-alike invoice number (O for 0) is still a duplicate', () => {
    const inv = invoiceFor('S1', undefined, { id: 'x', file_hash: 'f'.repeat(64), invoice_no: 'INV-1O01' })
    const r = runChecks(ctxFor(inv, s1Active())).find((x) => x.name === 'Same invoice number')!
    expect(r.status).toBe('fail'); expect(r.reason).toContain('look-alike')
  })
  it('amount changed after the AI reading is flagged', () => {
    const inv = invoiceFor('S1', undefined, { amount: 264000, edited_fields: ['amount'] })
    expect(names(inv)['Changed after AI reading']).toBe('warn')
  })
  it('low AI confidence and manual entry both warn', () => {
    expect(names(invoiceFor('S1', undefined, { ai_confidence: 0.6 })).Extraction).toBe('warn')
    expect(names(invoiceFor('S1', undefined, { ai_source: 'manual', ai_fields: null })).Extraction).toBe('warn')
  })
  it('unknown PO fails', () => {
    expect(names(invoiceFor('S1', undefined, { po_number: 'PO-9999' }))['PO found']).toBe('fail')
  })
  it('slightly altered vendor name warns', () => {
    expect(names(invoiceFor('S1', undefined, { vendor_name: 'Ravi Plastlcs' }))['Vendor identity']).toBe('warn')
  })
})
