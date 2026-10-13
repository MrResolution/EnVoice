// Supplier submits the fields they checked beside the document. Saves them, runs every check, scores,
// decides, and writes four audit steps. Rules first: any fail rejects, whatever the score.

import { appendAudit, handle, HttpError, must, snapshotRecord } from '../_shared/db.ts'
import { editedFields, runChecks } from '../_shared/checks.ts'
import { riskScore } from '../_shared/risk.ts'
import { buyerCredit } from '../_shared/credit.ts'
import { decide } from '../_shared/decide.ts'
import { cleanFields } from '../_shared/fields.ts'
import { list, lookalike, ref, round2 } from '../_shared/normalize.ts'
import type { CheckResult, Invoice, InvoiceFields } from '../_shared/types.ts'

const STATUS = { reject: 'rejected', review: 'review', auto_approve: 'checked' } as const

handle(['supplier'], async (body, caller, db) => {
  const id = String(body.invoice_id ?? '')
  const inv = await must(db.from('invoices').select('*').eq('id', id).eq('supplier_id', caller.party_id!).maybeSingle(), 'Invoice')
  if (inv.status !== 'extracted') throw new HttpError(409, 'This invoice was already submitted.')

  const buyer_id = String(body.buyer_id ?? inv.buyer_id ?? '')
  const buyer = await must(db.from('parties').select('*').eq('id', buyer_id).eq('type', 'buyer').maybeSingle(), 'Buyer')
  const supplier = await must(db.from('parties').select('*').eq('id', caller.party_id!).single(), 'Supplier')

  // Edits are computed here from what the AI read, never taken from the app.
  const fields: InvoiceFields = cleanFields(body.fields)
  const edited = inv.ai_fields ? editedFields(inv.ai_fields, fields) : []
  const qty = fields.line_items.length ? round2(fields.line_items.reduce((s, l) => s + l.qty, 0)) : null
  await must(db.from('invoices').update({
    ...fields, buyer_id, qty, edited_fields: edited, invoice_no_norm: lookalike(fields.invoice_no),
  }).eq('id', id).select('id').single(), 'Saving fields')

  const { row, hash } = await snapshotRecord(db, id)
  await appendAudit(db, {
    invoice_id: id, event_type: 'fields_extracted', file_hash: row.file_hash, record_hash: hash, actor_id: caller.id,
    summary: `fields confirmed by the supplier · ${edited.length ? `${edited.length} changed after AI reading` : 'no changes after AI reading'}`,
  })

  // Context for the pure checks, loaded once.
  const pos = await must(db.from('purchase_orders').select('*').eq('buyer_id', buyer_id).eq('supplier_id', caller.party_id!), 'POs')
  const po = pos.find((p) => ref(p.po_number) === ref(row.po_number)) ?? null
  const receipt = po ? (await db.from('delivery_receipts').select('*').eq('po_id', po.id).limit(1).maybeSingle()).data : null
  const others = await must(db.from('invoices').select('*').neq('id', id).not('status', 'in', '(uploaded,extracted)'), 'Other invoices')
  const num = (x: Record<string, unknown>) => ({ ...x, subtotal: n(x.subtotal), tax_amount: n(x.tax_amount), amount: n(x.amount), ai_confidence: n(x.ai_confidence) })
  const ctx = {
    invoice: num(row) as unknown as Invoice, supplier: numParty(supplier), buyer: numParty(buyer),
    po: po ? { ...po, qty: +po.qty, unit_price: +po.unit_price, total: +po.total, tax_rate: +po.tax_rate } : null,
    receipt: receipt ? { ...receipt, qty_delivered: +receipt.qty_delivered } : null,
    others: others.map((o) => num(o) as unknown as Invoice),
  }

  let results = runChecks(ctx)
  const credit = buyerCredit(ctx.buyer)
  let d = decide(results, credit)
  let status: string = STATUS[d.decision]
  const save = (extra: CheckResult[] = []) => {
    results = [...results, ...extra]
    const risk = riskScore(results)
    return { risk, patch: {
      status, decision: d.decision, decided_by: 'engine', decision_reasons: d.reasons, advance_pct: d.advancePct || null,
      risk_score: risk.score, risk_level: risk.level, risk_breakdown: risk.breakdown, risk_summary: risk.summary,
      buyer_score: credit.score, buyer_score_parts: { ...credit.parts, newBuyer: credit.newBuyer, reason: credit.reason },
    } }
  }
  let { risk, patch } = save()
  let upd = await db.from('invoices').update(patch).eq('id', id)
  if (upd.error?.code === '23505') {
    // Lost the race against another active invoice with the same number: that is a duplicate.
    const dup: CheckResult = { name: 'Same invoice number', category: 'duplicates', status: 'fail', reason: `${row.invoice_no} became active on another invoice at the same moment.` }
    results = results.filter((x) => x.name !== 'Same invoice number')
    d = decide([...results, dup], credit); status = 'rejected'
    ;({ risk, patch } = save([dup]))
    upd = await db.from('invoices').update(patch).eq('id', id)
  }
  if (upd.error) throw new Error(`decision update: ${upd.error.message}`)

  await db.from('invoice_checks').delete().eq('invoice_id', id)
  await must(db.from('invoice_checks').insert(results.map((x, i) => ({
    invoice_id: id, position: i, name: x.name, category: x.category, status: x.status, reason: x.reason, detail: x.values ?? null,
  }))).select('id'), 'Saving checks')

  const count = (s: string) => results.filter((x) => x.status === s).length
  const parts = [`${count('pass')} pass`, count('warn') && `${count('warn')} warn`, count('fail') && `${count('fail')} fail`].filter(Boolean) as string[]
  await appendAudit(db, { invoice_id: id, event_type: 'checks_completed', actor_id: caller.id,
    summary: `${results.length} checks: ${list(parts)} · risk ${risk.score} ${risk.level} · buyer credit ${credit.score}` })
  await appendAudit(db, { invoice_id: id, event_type: 'decision_made', actor_id: caller.id,
    summary: `decision: ${d.decision.replace('_', '-')} (engine)${d.advancePct ? ` · advance ${d.advancePct}%` : ''}` })

  return { invoice_id: id, status, decision: d.decision, reasons: d.reasons, risk, credit }
})

function n(v: unknown) { return v === null || v === undefined ? null : Number(v) }
function numParty(p: Record<string, unknown>) {
  return { ...p, credit_limit: +(p.credit_limit as number), outstanding: +(p.outstanding as number), avg_delay_days: +(p.avg_delay_days as number),
    on_time_rate: n(p.on_time_rate), avg_invoice_amount: n(p.avg_invoice_amount) } as never
}
