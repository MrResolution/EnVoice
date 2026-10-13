// Cleans whatever the AI (or a person) returned into InvoiceFields. The reply is untrusted:
// wrong types, negative money and impossible dates become null, and missing fields then fail the extraction check.

import type { InvoiceFields, LineItem, Party } from './types.ts'
import { currency, gstin, isoDate, money, name, round2, similarity } from './normalize.ts'

export const FIELD_KEYS = ['invoice_no', 'invoice_date', 'due_date', 'vendor_name', 'vendor_gstin', 'buyer_name', 'buyer_gstin',
  'po_number', 'currency', 'subtotal', 'tax_amount', 'amount', 'bank_account', 'line_items'] as const

const text = (v: unknown, max = 120) => {
  if (v === null || v === undefined || typeof v === 'object') return null
  const s = String(v).replace(/\s+/g, ' ').trim().slice(0, max)
  return s || null
}
const amount = (v: unknown) => {
  const n = money(v)
  return n === null || n < 0 || n > 1e11 ? null : n
}

function lineItems(v: unknown): LineItem[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 50).flatMap((l) => {
    if (!l || typeof l !== 'object') return []
    const o = l as Record<string, unknown>
    const qty = amount(o.qty), unit_price = amount(o.unit_price)
    const description = text(o.description, 200)
    if (!description || qty === null || unit_price === null) return []
    return [{ description, hsn: text(o.hsn, 12), qty, unit_price, amount: amount(o.amount) ?? round2(qty * unit_price) }]
  })
}

export function cleanFields(raw: unknown): InvoiceFields {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    invoice_no: text(o.invoice_no, 40),
    invoice_date: isoDate(o.invoice_date),
    due_date: isoDate(o.due_date),
    vendor_name: text(o.vendor_name),
    vendor_gstin: gstin(text(o.vendor_gstin, 20)),
    buyer_name: text(o.buyer_name),
    buyer_gstin: gstin(text(o.buyer_gstin, 20)),
    po_number: text(o.po_number, 40),
    currency: currency(text(o.currency, 10)),
    subtotal: amount(o.subtotal),
    tax_amount: amount(o.tax_amount),
    amount: amount(o.amount),
    bank_account: text(o.bank_account, 34)?.replace(/[^0-9A-Za-z]/g, '') || null,
    line_items: lineItems(o.line_items),
  }
}

/** 0–1, or null when the reply had none. */
export function confidence(raw: unknown): number | null {
  const c = Number((raw as Record<string, unknown> | null)?.confidence)
  return Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : null
}

/** The real type from the first bytes. The upload's claimed MIME type and extension are not trusted. */
export function sniffType(b: Uint8Array): 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp' | null {
  const at = (i: number, s: string) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0))
  if (at(0, '%PDF-')) return 'application/pdf'
  if (b[0] === 0x89 && at(1, 'PNG')) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'image/webp'
  return null
}

/** GSTIN first (exact), then name similarity ≥ 0.8. null = the supplier picks from the list. */
export function matchBuyer(f: Pick<InvoiceFields, 'buyer_gstin' | 'buyer_name'>, buyers: Pick<Party, 'id' | 'name' | 'gstin'>[]) {
  if (f.buyer_gstin) {
    const hit = buyers.find((b) => gstin(b.gstin) === f.buyer_gstin)
    if (hit) return hit.id
  }
  let best: { id: string; sim: number } | null = null
  for (const b of buyers) {
    const sim = similarity(name(f.buyer_name), name(b.name))
    if (sim >= 0.8 && (!best || sim > best.sim)) best = { id: b.id, sim }
  }
  return best?.id ?? null
}
