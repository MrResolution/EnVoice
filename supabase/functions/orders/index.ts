// Buyers raise purchase orders and record deliveries from the app. These are the records every
// invoice is matched against, so they are written here (role-checked) and audited, never by the client.

import { appendAudit, handle, HttpError, must } from '../_shared/db.ts'
import { isoDate, money, ref, round2 } from '../_shared/normalize.ts'

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const today = () => new Date().toISOString().slice(0, 10)

handle(['buyer'], async (body, caller, db) => {
  if (body.action === 'create_po') {
    const supplier = await must(db.from('parties').select('id, name').eq('id', String(body.supplier_id ?? '')).eq('type', 'supplier').maybeSingle(), 'Supplier')
    const po_number = text(body.po_number, 30).toUpperCase()
    if (!ref(po_number)) throw new HttpError(400, 'Enter a PO number.')
    const item = text(body.item, 120)
    if (item.length < 2) throw new HttpError(400, 'Describe the item.')
    const qty = money(body.qty), unit_price = money(body.unit_price), tax_rate = money(body.tax_rate ?? 18)
    if (!qty || qty <= 0) throw new HttpError(400, 'Quantity must be more than zero.')
    if (unit_price === null || unit_price < 0) throw new HttpError(400, 'Enter the unit price.')
    if (tax_rate === null || tax_rate < 0 || tax_rate > 28) throw new HttpError(400, 'GST is between 0 and 28%.')
    const total = round2(qty * unit_price * (1 + tax_rate / 100))
    const { data, error } = await db.from('purchase_orders').insert({
      po_number, buyer_id: caller.party_id, supplier_id: supplier.id, item, hsn: text(body.hsn, 12) || null,
      qty, unit_price, tax_rate, total, po_date: isoDate(body.po_date) ?? today(), created_by: caller.id,
    }).select('id, po_number, total').single()
    if (error?.code === '23505') throw new HttpError(409, `You already used ${po_number}. Pick another number.`)
    if (error) throw new Error(error.message)
    await appendAudit(db, { invoice_id: null, event_type: 'po_raised', actor_id: caller.id, summary: `purchase order raised for ${qty} units` })
    return data
  }

  if (body.action === 'record_delivery') {
    const po = await must(db.from('purchase_orders').select('id, po_number, qty').eq('id', String(body.po_id ?? '')).eq('buyer_id', caller.party_id!).maybeSingle(), 'Purchase order')
    const qty_delivered = money(body.qty_delivered)
    if (qty_delivered === null || qty_delivered < 0) throw new HttpError(400, 'Enter how many units arrived.')
    const delivered_on = isoDate(body.delivered_on) ?? today()
    if (delivered_on > today()) throw new HttpError(400, "A delivery can't be in the future.")
    const grn_number = text(body.grn_number, 30) || `GRN-${po.po_number.replace(/\D/g, '').slice(-4) || Date.now().toString().slice(-4)}`
    const { data, error } = await db.from('delivery_receipts').insert({
      po_id: po.id, grn_number, qty_delivered, delivered_on, confirmed_by_buyer: true, created_by: caller.id,
    }).select('id, grn_number').single()
    if (error?.code === '23505') throw new HttpError(409, `A delivery is already recorded for ${po.po_number}.`)
    if (error) throw new Error(error.message)
    await appendAudit(db, { invoice_id: null, event_type: 'delivery_recorded', actor_id: caller.id, summary: `delivery recorded: ${qty_delivered} of ${po.qty} units` })
    return data
  }

  throw new HttpError(400, 'Unknown action.')
})
