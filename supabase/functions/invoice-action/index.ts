// Buyer confirms or disputes; lender approves or rejects a flagged invoice. The offer is released only when
// the invoice is cleared (engine or lender) AND the buyer confirmed, and only after re-checking the audit chain.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3'
import { appendAudit, fileHash, handle, HttpError, must, type Caller } from '../_shared/db.ts'
import { latestRecorded, recordHash, type Entry } from '../_shared/audit.ts'
import { offerTerms } from '../_shared/decide.ts'
import { inr } from '../_shared/normalize.ts'

const ACTIONS = { confirm: 'buyer', dispute: 'buyer', approve: 'lender', reject: 'lender', accept: 'supplier' } as const
const CLEARED = ['checked', 'approved']

handle(['buyer', 'lender', 'supplier'], async (body, caller, db) => {
  const action = String(body.action) as keyof typeof ACTIONS
  if (ACTIONS[action] !== caller.role) throw new HttpError(403, `A ${caller.role} can't ${action} an invoice.`)
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) || null : null
  const inv = await must(db.from('invoices').select('*').eq('id', String(body.invoice_id ?? '')).maybeSingle(), 'Invoice')
  const audit = (event_type: string, summary: string) => appendAudit(db, { invoice_id: inv.id, event_type, summary, actor_id: caller.id })

  if (caller.role === 'supplier') {
    // The supplier takes the released offer (mock payout: no money moves in this prototype).
    if (inv.supplier_id !== caller.party_id) throw new HttpError(404, 'Invoice not found.')
    const offer = await must(db.from('financing_offers').select('id, status, advance_amount').eq('invoice_id', inv.id).maybeSingle(), 'Offer')
    if (offer.status === 'accepted') throw new HttpError(409, 'You already accepted this offer.')
    await must(db.from('financing_offers').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', offer.id).select('id').single(), 'Offer')
    await audit('offer_accepted', 'supplier accepted the advance (mock payout)')
    return { status: inv.status, message: `Accepted. ${inr(Number(offer.advance_amount))} is on its way (mock payout).` }
  }

  if (caller.role === 'buyer') {
    if (inv.buyer_id !== caller.party_id || ['uploaded', 'extracted'].includes(inv.status)) throw new HttpError(404, 'Invoice not found.')
    if (inv.status === 'rejected' || inv.status === 'offer_released') throw new HttpError(409, 'This invoice is already closed.')
    if (inv.buyer_status !== 'pending') throw new HttpError(409, `You already ${inv.buyer_status} this invoice.`)
    if (action === 'confirm') {
      await upd(db, inv.id, { buyer_status: 'confirmed', buyer_note: note })
      await audit('buyer_confirmed', 'buyer confirmed the goods and the amount')
      if (CLEARED.includes(inv.status)) return await release(db, caller, { ...inv, buyer_status: 'confirmed' })
      return { status: inv.status, message: 'Confirmed. The lender still has to review this invoice.' }
    }
    if (!note) throw new HttpError(400, 'Please say why you dispute this invoice.')
    await upd(db, inv.id, { buyer_status: 'disputed', buyer_note: note, status: 'review', decision: 'review',
      decision_reasons: [...(inv.decision_reasons ?? []), 'The buyer disputed this invoice.'] })
    await audit('buyer_disputed', 'buyer disputed the invoice (reason kept on the invoice, not in the log)')
    return { status: 'review', message: 'Disputed. The lender will review it.' }
  }

  // Lender
  if (inv.status !== 'review') throw new HttpError(409, 'Only invoices in review need a lender decision.')
  if (action === 'reject') {
    await upd(db, inv.id, { status: 'rejected', decision: 'reject', decided_by: 'lender', decision_reasons: [note ?? 'Rejected by the lender after review.'] })
    await audit('decision_made', 'decision: reject (lender)')
    return { status: 'rejected', message: 'Rejected.' }
  }
  if (inv.buyer_status === 'disputed') throw new HttpError(409, "The buyer disputed this invoice; it can't be financed until that's resolved.")
  await upd(db, inv.id, { status: 'approved', decision: 'approve', decided_by: 'lender',
    decision_reasons: [note ?? `Approved by the lender after review at ${inv.advance_pct}% advance.`] })
  await audit('decision_made', `decision: approve (lender) · advance ${inv.advance_pct}%`)
  if (inv.buyer_status === 'confirmed') return await release(db, caller, { ...inv, status: 'approved' })
  return { status: 'approved', message: 'Approved. The offer is released once the buyer confirms.' }
})

async function upd(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  const { error } = await db.from('invoices').update(patch).eq('id', id)
  if (error) throw new Error(`invoice update: ${error.message}`)
}

/** Last line of defence: the row and the file must still be what the audit chain recorded. */
async function release(db: SupabaseClient, caller: Caller, inv: Record<string, any>) {
  const entries = await must(db.from('audit_log').select('*').eq('invoice_id', inv.id).order('seq'), 'Audit entries') as Entry[]
  const rec = latestRecorded(entries).get(inv.id)
  const fresh = await must(db.from('invoices').select('*').eq('id', inv.id).single(), 'Invoice')
  const problems: string[] = []
  if (!rec?.record || rec.record !== await recordHash(fresh)) problems.push(`the invoice record changed after entry #${rec?.recordSeq ?? '?'}`)
  if (!rec?.file || rec.file !== await fileHash(db, inv.file_path)) problems.push('the stored file is not the file that was uploaded')
  if (problems.length) {
    const reason = `Chain integrity: ${problems.join(' and ')}.`
    await db.from('invoice_checks').insert({ invoice_id: inv.id, position: 99, name: 'Chain integrity', category: 'integrity', status: 'fail', reason })
    await upd(db, inv.id, { status: 'rejected', decision: 'reject', decision_reasons: [reason] })
    await appendAudit(db, { invoice_id: inv.id, event_type: 'decision_made', actor_id: caller.id, summary: 'decision: reject (integrity check at payout)' })
    return { status: 'rejected', message: reason }
  }

  const amount = Number(fresh.amount), pct = Number(fresh.advance_pct)
  const t = offerTerms(amount, pct, fresh.invoice_date, fresh.due_date)
  const reasons = [
    `${pct}% of ${inr(amount)} because buyer credit is ${fresh.buyer_score}.`,
    `Fee ${inr(t.fee)}: 1.5% of the advance for each of ${t.months} started 30-day period${t.months > 1 ? 's' : ''} until the due date.`,
    fresh.decided_by === 'lender' ? 'Approved by the lender after review; the buyer confirmed.' : 'Every check passed; the buyer confirmed.',
  ]
  await must(db.from('financing_offers').insert({
    invoice_id: inv.id, lender_id: caller.role === 'lender' ? caller.id : null,
    advance_pct: pct, advance_amount: t.advance, fee_amount: t.fee, reasons,
  }).select('id').single(), 'Offer')
  await upd(db, inv.id, { status: 'offer_released' })
  await appendAudit(db, { invoice_id: inv.id, event_type: 'offer_released', actor_id: caller.id,
    summary: `offer released · ${pct}% advance · record and file re-verified` })
  return { status: 'offer_released', message: `Offer released: ${inr(t.advance)} advance (${pct}%).` }
}
