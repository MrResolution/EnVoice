// The checks engine. Every check is one pure function: (ctx) => {name, category, status, reason} | null.
// The AI never decides anything here; it only supplied the field values in ctx.invoice.
// To add a check: write a function below, add it to CHECKS, add a test in tests/engine.

import type { Category, Check, CheckResult, Ctx, Invoice, InvoiceFields, MatchValues, Status } from './types.ts'
import {
  address, day, daysBetween, digits, emailDomain, gstin, hamming, inr, levenshtein, list, lookalike, mask, money,
  name, overlap, pct, poss, PUBLIC_EMAIL, qty, ref, round2, similarity,
} from './normalize.ts'
import { short } from './canon.ts'

/** Up to 2% over is tolerated everywhere: rounding and tax differences on real invoices. */
const TOL = 0.02
/** Invoices that count as live claims. Drafts (uploaded/extracted) and rejected ones don't block anything. */
export const ACTIVE = new Set(['checked', 'review', 'approved', 'offer_released'])

const r = (name: string, category: Category, status: Status, reason: string, values?: MatchValues): CheckResult =>
  values ? { name, category, status, reason, values } : { name, category, status, reason }
const active = (ctx: Ctx) => ctx.others.filter((o) => ACTIVE.has(o.status))
const same = (a: string | null, b: string | null) => a !== null && a === b
const totalQty = (inv: InvoiceFields) => (inv.line_items.length ? round2(inv.line_items.reduce((s, l) => s + l.qty, 0)) : null)
/** The invoice line that best matches the PO item (samples have one line; real invoices may have more). */
const mainLine = (inv: InvoiceFields, item: string) =>
  inv.line_items.reduce((best, l) => (overlap(l.description, item) > overlap(best.description, item) ? l : best), inv.line_items[0])

// ---------- Three-way match: invoice vs purchase order vs delivery receipt (weight 35) ----------

export const poFound: Check = ({ invoice, po, buyer }) => {
  if (!invoice.po_number) return r('PO found', 'three_way', 'fail', 'The invoice has no PO number, so there is nothing to check it against.', { invoice: '—' })
  if (!po) return r('PO found', 'three_way', 'fail', `${invoice.po_number} doesn't exist for ${buyer?.name ?? 'this buyer'}.`, { invoice: invoice.po_number, po: 'not found' })
  return r('PO found', 'three_way', 'pass', `${po.po_number} from ${buyer?.name ?? 'the buyer'} matches.`, { invoice: invoice.po_number, po: po.po_number })
}

export const deliveryReceipt: Check = ({ po, receipt }) => {
  if (!po) return null
  if (!receipt) return r('Delivery receipt', 'three_way', 'fail', `There is no delivery receipt for ${po.po_number}, so nothing proves the goods arrived.`, { receipt: 'missing' })
  if (!receipt.confirmed_by_buyer) return r('Delivery receipt', 'three_way', 'fail', `Delivery receipt ${receipt.grn_number} isn't confirmed by the buyer.`, { receipt: `${receipt.grn_number} (unconfirmed)` })
  return r('Delivery receipt', 'three_way', 'pass', `${receipt.grn_number}: ${qty(receipt.qty_delivered)} delivered on ${day(receipt.delivered_on)}, confirmed by the buyer.`, { receipt: receipt.grn_number })
}

export const amountVsPo: Check = ({ invoice, po }) => {
  if (!po || invoice.amount === null) return null
  const values = { invoice: inr(invoice.amount), po: inr(po.total) }
  const over = round2(invoice.amount - po.total)
  if (over <= 0) return r('Amount vs PO', 'three_way', 'pass', `${inr(invoice.amount)} is within the approved ${inr(po.total)}.`, values)
  const gap = over / po.total
  return r('Amount vs PO', 'three_way', gap <= TOL ? 'warn' : 'fail', `${inr(invoice.amount)} exceeds ${po.po_number} (${inr(po.total)}) by ${inr(over)} (${pct(gap)}).`, values)
}

export const poBalance: Check = (ctx) => {
  const { invoice, po } = ctx
  if (!po || invoice.amount === null) return null
  const earlier = active(ctx).filter((o) => o.buyer_id === invoice.buyer_id && ref(o.po_number) === ref(po.po_number))
  if (!earlier.length) return r('PO balance', 'three_way', 'pass', `Nothing else is invoiced against ${po.po_number}.`)
  const used = round2(earlier.reduce((s, o) => s + (o.amount ?? 0), 0))
  const total = round2(used + invoice.amount)
  const by = list(earlier.map((o) => o.invoice_no ?? 'an earlier invoice'))
  if (total <= po.total * (1 + TOL)) return r('PO balance', 'three_way', 'pass', `${inr(used)} already invoiced by ${by}; ${inr(total)} of ${inr(po.total)} used with this one.`)
  const state = used >= po.total ? 'already fully invoiced' : `already invoiced for ${inr(used)}`
  return r('PO balance', 'three_way', 'fail', `${po.po_number} is ${state} by ${by} (${inr(po.total)} approved).`)
}

export const qtyDelivered: Check = ({ invoice, receipt }) => {
  if (!receipt) return null
  const billed = totalQty(invoice)
  if (billed === null) return r('Quantity vs delivered', 'three_way', 'warn', 'The invoice shows no quantity to compare with the delivery.', { invoice: '—', receipt: qty(receipt.qty_delivered) })
  const values = { invoice: qty(billed), receipt: qty(receipt.qty_delivered) }
  const gap = receipt.qty_delivered ? (billed - receipt.qty_delivered) / receipt.qty_delivered : 1
  if (gap <= TOL) return r('Quantity vs delivered', 'three_way', 'pass', `${qty(billed)} billed, ${qty(receipt.qty_delivered)} delivered.`, values)
  return r('Quantity vs delivered', 'three_way', 'warn', `${qty(billed)} billed but only ${qty(receipt.qty_delivered)} delivered (${pct(gap)}).`, values)
}

export const unitPrice: Check = ({ invoice, po }) => {
  if (!po || !invoice.line_items.length) return null
  const line = mainLine(invoice, po.item)
  const values = { invoice: inr(line.unit_price), po: inr(po.unit_price) }
  const gap = (line.unit_price - po.unit_price) / po.unit_price
  if (gap <= TOL) return r('Unit price vs PO', 'three_way', 'pass', `${inr(line.unit_price)} per unit; ${po.po_number} says ${inr(po.unit_price)}.`, values)
  return r('Unit price vs PO', 'three_way', 'warn', `${inr(line.unit_price)} per unit vs ${inr(po.unit_price)} on ${po.po_number} (${pct(gap)}).`, values)
}

export const itemsMatch: Check = ({ invoice, po }) => {
  if (!po || !invoice.line_items.length) return null
  const line = mainLine(invoice, po.item)
  const values = { invoice: line.description, po: po.item }
  if (overlap(line.description, po.item) >= 0.5) return r('Items vs PO', 'three_way', 'pass', `"${line.description}" matches the PO item.`, values)
  return r('Items vs PO', 'three_way', 'warn', `"${line.description}" doesn't match the PO item "${po.item}".`, values)
}

export const deliveryDate: Check = ({ invoice, receipt }) => {
  if (!receipt || !invoice.invoice_date) return null
  const values = { invoice: day(invoice.invoice_date), receipt: day(receipt.delivered_on) }
  const d = daysBetween(receipt.delivered_on, invoice.invoice_date)
  if (d >= -2 && d <= 30) {
    const when = d === 0 ? 'on the delivery day' : d > 0 ? `${d} day${d > 1 ? 's' : ''} after delivery` : `${-d} day${d < -1 ? 's' : ''} before delivery`
    return r('Invoice date vs delivery', 'three_way', 'pass', `Invoiced ${when}.`, values)
  }
  const reason = d < 0 ? `The invoice is dated ${-d} days before the goods were delivered.` : `The invoice is dated ${d} days after delivery.`
  return r('Invoice date vs delivery', 'three_way', 'warn', reason, values)
}

// ---------- Duplicates: layered, because fraudsters change one character (weight 25) ----------

export const sameFile: Check = ({ invoice, others }) => {
  const twin = others.find((o) => o.file_hash === invoice.file_hash && (ACTIVE.has(o.status) || o.status === 'rejected'))
  if (!twin) return r('Same file', 'duplicates', 'pass', 'No earlier submission has this exact file.')
  if (twin.status === 'rejected') return r('Same file', 'duplicates', 'warn', `This exact file was submitted before (${twin.invoice_no ?? 'unnamed'}) and rejected.`)
  return r('Same file', 'duplicates', 'fail', `This exact file was already submitted as ${twin.invoice_no} on ${day(twin.created_at)}.`)
}

export const sameNumber: Check = (ctx) => {
  const { invoice } = ctx
  const key = lookalike(invoice.invoice_no)
  if (!key) return null
  const twin = active(ctx).find((o) => o.supplier_id === invoice.supplier_id && o.buyer_id === invoice.buyer_id && lookalike(o.invoice_no) === key)
  if (!twin) return r('Same invoice number', 'duplicates', 'pass', `${invoice.invoice_no} hasn't been used before for this buyer.`)
  const lead = ref(twin.invoice_no) === ref(invoice.invoice_no)
    ? `${twin.invoice_no} was`
    : `${invoice.invoice_no} differs only by look-alike characters from ${twin.invoice_no}, which was`
  return r('Same invoice number', 'duplicates', 'fail', `${lead} already submitted on ${day(twin.created_at)} for ${inr(twin.amount)}.`)
}

const sameItems = (a: Invoice, b: Invoice) =>
  a.line_items.length > 0 && b.line_items.length > 0 && totalQty(a) === totalQty(b) &&
  overlap(a.line_items.map((l) => l.description).join(' '), b.line_items.map((l) => l.description).join(' ')) >= 0.8

/** Scores resemblance to every live invoice to the same buyer. The image hash is only ever one point:
 *  invoices printed from the same template look alike even when they are different invoices. */
export const nearDuplicate: Check = (ctx) => {
  const { invoice } = ctx
  if (invoice.amount === null) return null
  let best: { o: Invoice; points: number; signs: string[] } | null = null
  for (const o of active(ctx)) {
    if (o.buyer_id !== invoice.buyer_id || o.amount === null || o.file_hash === invoice.file_hash) continue
    if (o.supplier_id === invoice.supplier_id && lookalike(o.invoice_no) === lookalike(invoice.invoice_no)) continue // sameNumber reports it
    const signs: string[] = []
    let points = 0
    const gap = Math.abs(invoice.amount - o.amount) / o.amount
    if (gap <= 0.02) { points += 2; signs.push(gap === 0 ? 'same amount' : 'almost the same amount') }
    else if (gap <= 0.10) { points += 1; signs.push(`amount within ${Math.ceil(gap * 100)}%`) }
    if (sameItems(invoice, o)) { points += 2; signs.push('same items and quantity') }
    if (invoice.invoice_date && o.invoice_date && Math.abs(daysBetween(o.invoice_date, invoice.invoice_date)) <= 3) {
      points += 1
      signs.push(invoice.invoice_date === o.invoice_date ? 'same date' : 'dates within 3 days')
    }
    const a = ref(invoice.invoice_no), b = ref(o.invoice_no)
    const dist = a && b ? levenshtein(a, b) : 99
    if (dist <= 2) { points += 1; signs.push(`number differs by ${dist} character${dist > 1 ? 's' : ''}`) }
    const bits = hamming(invoice.image_hash, o.image_hash)
    if (bits !== null && bits <= 10) { points += 1; signs.push('image nearly identical') }
    if (points >= 4 && (!best || points > best.points)) best = { o, points, signs }
  }
  if (!best) return r('Near-duplicate', 'duplicates', 'pass', 'No earlier invoice to this buyer looks like this one.')
  return r('Near-duplicate', 'duplicates', 'warn', `Looks like ${best.o.invoice_no} from ${day(best.o.created_at)}: ${list(best.signs)}.`)
}

// ---------- Vendor / bank validation (weight 15) ----------

export const selfDealing: Check = ({ supplier, buyer }) => {
  if (!buyer) return null
  const shared: string[] = []
  if (same(gstin(supplier.gstin), gstin(buyer.gstin))) shared.push(`GSTIN ${gstin(supplier.gstin)}`)
  if (same(digits(supplier.bank_account), digits(buyer.bank_account))) shared.push(`bank account ${mask(supplier.bank_account)}`)
  if (same(digits(supplier.phone), digits(buyer.phone))) shared.push(`phone number ${mask(supplier.phone)}`)
  const domain = emailDomain(supplier.email)
  if (domain && !PUBLIC_EMAIL.has(domain) && domain === emailDomain(buyer.email)) shared.push(`email domain ${domain}`)
  if (same(address(supplier.address), address(buyer.address))) shared.push('address')
  if (!shared.length) return r('Self-dealing', 'vendor_bank', 'pass', `${supplier.name} and ${buyer.name} share no GSTIN, bank account, phone, email domain or address.`)
  return r('Self-dealing', 'vendor_bank', 'fail', `${supplier.name} and ${buyer.name} share ${list(shared)}: possible self-dealing.`)
}

export const bankAccount: Check = ({ invoice, supplier }) => {
  const onInvoice = digits(invoice.bank_account), approved = digits(supplier.bank_account)
  if (!onInvoice) return r('Bank account', 'vendor_bank', 'pass', `No account printed; payment goes to the approved account ${mask(approved)}.`)
  if (onInvoice === approved) return r('Bank account', 'vendor_bank', 'pass', `Pays into ${poss(supplier.name)} approved account ${mask(approved)}.`)
  return r('Bank account', 'vendor_bank', 'warn', `Bank account ${mask(onInvoice)} on the invoice differs from ${poss(supplier.name)} approved ${mask(approved)}.`)
}

export const vendorIdentity: Check = ({ invoice, supplier }) => {
  if (!invoice.vendor_name) return r('Vendor identity', 'vendor_bank', 'warn', 'No vendor name is printed on the invoice.')
  const sim = similarity(name(invoice.vendor_name), name(supplier.name))
  const gstOk = !invoice.vendor_gstin || gstin(invoice.vendor_gstin) === gstin(supplier.gstin)
  if (sim >= 0.95) {
    return gstOk
      ? r('Vendor identity', 'vendor_bank', 'pass', `Issued by ${supplier.name}${invoice.vendor_gstin ? ', GSTIN matches' : ''}.`)
      : r('Vendor identity', 'vendor_bank', 'warn', `GSTIN ${gstin(invoice.vendor_gstin)} on the invoice isn't ${poss(supplier.name)} registered GSTIN.`)
  }
  if (sim >= 0.8) return r('Vendor identity', 'vendor_bank', 'warn', `Vendor name "${invoice.vendor_name}" is close to, but not the same as, "${supplier.name}".`)
  if (gstOk && invoice.vendor_gstin) return r('Vendor identity', 'vendor_bank', 'warn', `Vendor name "${invoice.vendor_name}" differs from ${supplier.name}, though the GSTIN matches.`)
  return r('Vendor identity', 'vendor_bank', 'fail', `Issued by "${invoice.vendor_name}", not ${supplier.name}.`)
}

// ---------- Document integrity (weight 15) ----------

export const fingerprint: Check = ({ invoice }) =>
  /^[0-9a-f]{64}$/.test(invoice.file_hash)
    ? r('Fingerprint', 'integrity', 'pass', `SHA-256 ${short(invoice.file_hash)} recorded.`)
    : r('Fingerprint', 'integrity', 'fail', 'The file has no valid SHA-256 fingerprint.')

const SOURCE = { gemini: 'Read by Gemini', cache: 'Cached AI result', reuse: 'Same file read before', manual: 'Typed by hand' }

export const extraction: Check = ({ invoice, buyer }) => {
  const missing = ([['invoice number', invoice.invoice_no], ['invoice date', invoice.invoice_date], ['amount', invoice.amount], ['buyer', buyer]] as const)
    .filter(([, v]) => v === null || v === undefined).map(([k]) => k)
  if (missing.length) return r('Extraction', 'integrity', 'fail', `Missing ${list([...missing])}.`)
  if (invoice.ai_source === 'manual') return r('Extraction', 'integrity', 'warn', 'Fields were typed by hand (AI unavailable): compare them with the document.')
  const sure = Math.round((invoice.ai_confidence ?? 0) * 100)
  if (sure < 80) return r('Extraction', 'integrity', 'warn', `The AI was only ${sure}% sure of its reading.`)
  return r('Extraction', 'integrity', 'pass', `${SOURCE[invoice.ai_source]}, ${sure}% confident.`)
}

/** Fields where a change after the AI reading could move money or hide a duplicate. */
const RISKY = ['invoice_no', 'vendor_name', 'po_number', 'amount', 'subtotal', 'tax_amount', 'bank_account', 'line_items']
const LABEL: Record<string, string> = {
  invoice_no: 'invoice number', vendor_name: 'vendor name', po_number: 'PO number', amount: 'total', subtotal: 'subtotal',
  tax_amount: 'tax', bank_account: 'bank account', line_items: 'line items', invoice_date: 'invoice date', due_date: 'due date',
  buyer_name: 'buyer name', buyer_gstin: 'buyer GSTIN', vendor_gstin: 'vendor GSTIN', currency: 'currency',
}

/** Which confirmed fields differ from what the AI read. Computed by run-checks on the server, never trusted from the app. */
export function editedFields(ai: Partial<InvoiceFields>, now: InvoiceFields): string[] {
  const norm = (k: string, v: unknown) =>
    k === 'line_items' ? JSON.stringify(((v as InvoiceFields['line_items']) ?? []).map((l) => [ref(l.description), money(l.qty), money(l.unit_price), money(l.amount)]))
      : ['subtotal', 'tax_amount', 'amount'].includes(k) ? money(v)
        : k === 'bank_account' ? digits(v)
          : k === 'invoice_no' || k === 'po_number' ? ref(v)
            : v === undefined || v === '' ? null : String(v).trim().toLowerCase()
  return (Object.keys(LABEL) as (keyof InvoiceFields)[]).filter((k) => norm(k, ai[k]) !== norm(k, now[k]))
}

export const editedAfterAi: Check = ({ invoice }) => {
  if (invoice.ai_source === 'manual' || !invoice.ai_fields) return null
  const edited = invoice.edited_fields
  if (!edited.length) return r('Changed after AI reading', 'integrity', 'pass', 'Nothing was changed after the AI reading.')
  const risky = edited.filter((f) => RISKY.includes(f))
  if (!risky.length) return r('Changed after AI reading', 'integrity', 'pass', `Corrected after the AI reading: ${list(edited.map((f) => LABEL[f] ?? f))}.`)
  const ai = invoice.ai_fields as Record<string, unknown>
  const now = invoice as unknown as Record<string, unknown>
  const what = risky.map((f) =>
    ['amount', 'subtotal', 'tax_amount'].includes(f) ? `${LABEL[f]} (AI read ${inr(money(ai[f]))}, now ${inr(money(now[f]))})`
      : f === 'bank_account' ? `bank account (AI read ${mask(ai[f])}, now ${mask(now[f])})`
        : LABEL[f])
  return r('Changed after AI reading', 'integrity', 'warn', `Changed after the AI reading: ${list(what)}.`)
}

export const totalsAddUp: Check = ({ invoice }) => {
  if (invoice.amount === null) return null
  const lines = invoice.line_items.length ? round2(invoice.line_items.reduce((s, l) => s + l.amount, 0)) : invoice.subtotal
  if (lines === null) return null
  const tax = invoice.tax_amount ?? 0
  const expected = round2(lines + tax)
  // ₹2 covers printed round-off lines; 0.1% covers paise rounding on big invoices.
  if (Math.abs(expected - invoice.amount) <= Math.max(2, invoice.amount * 0.001)) {
    return r('Totals add up', 'integrity', 'pass', `Lines ${inr(lines)} + tax ${inr(tax)} = ${inr(invoice.amount)}.`)
  }
  return r('Totals add up', 'integrity', 'warn', `Lines ${inr(lines)} + tax ${inr(tax)} = ${inr(expected)}, but the total says ${inr(invoice.amount)}.`)
}

export const currencyInr: Check = ({ invoice }) =>
  !invoice.currency || invoice.currency === 'INR'
    ? r('Currency', 'integrity', 'pass', 'Amounts are in rupees (INR).')
    : r('Currency', 'integrity', 'warn', `The invoice is in ${invoice.currency}; the prototype only finances INR.`)

// ---------- Behaviour: soft signals, never a hard stop (weight 10) ----------

export const amountSpike: Check = ({ invoice, supplier }) => {
  if (invoice.amount === null || !supplier.avg_invoice_amount) return null
  const x = invoice.amount / supplier.avg_invoice_amount
  if (x <= 3) return r('Amount vs usual', 'behaviour', 'pass', `In line with ${poss(supplier.name)} usual invoice of about ${inr(supplier.avg_invoice_amount)}.`)
  return r('Amount vs usual', 'behaviour', 'warn', `${x.toFixed(1)}× ${poss(supplier.name)} usual invoice of about ${inr(supplier.avg_invoice_amount)}.`)
}

export const paymentTerms: Check = ({ invoice }) => {
  if (!invoice.invoice_date || !invoice.due_date) return null
  const d = daysBetween(invoice.invoice_date, invoice.due_date)
  if (d < 0) return r('Payment terms', 'behaviour', 'warn', 'The due date is before the invoice date.')
  if (d <= 90) return r('Payment terms', 'behaviour', 'pass', `Due in ${d} days.`)
  return r('Payment terms', 'behaviour', 'warn', `Due in ${d} days, unusually long (over 90).`)
}

/** Order matters only for display: the matrix rows first, then the rest by category. */
export const CHECKS: Check[] = [
  poFound, deliveryReceipt, amountVsPo, poBalance, qtyDelivered, unitPrice, itemsMatch, deliveryDate,
  sameFile, sameNumber, nearDuplicate,
  selfDealing, bankAccount, vendorIdentity,
  fingerprint, extraction, editedAfterAi, totalsAddUp, currencyInr,
  amountSpike, paymentTerms,
]

export const runChecks = (ctx: Ctx): CheckResult[] => CHECKS.map((check) => check(ctx)).filter((x): x is CheckResult => x !== null)
