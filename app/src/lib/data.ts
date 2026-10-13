import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { LineItem } from '@shared/types.ts'
import type { RiskRow } from '@shared/risk.ts'

export type InvoiceRow = {
  id: string; supplier_id: string; buyer_id: string | null; status: string; buyer_status: 'pending' | 'confirmed' | 'disputed'
  decision: string | null; decided_by: string | null; decision_reasons: string[]
  file_path: string; file_type: string; file_size: number; file_hash: string; image_hash: string | null
  invoice_no: string | null; invoice_date: string | null; due_date: string | null; vendor_name: string | null; vendor_gstin: string | null
  buyer_name: string | null; buyer_gstin: string | null; po_number: string | null; currency: string | null
  subtotal: number | null; tax_amount: number | null; amount: number | null; bank_account: string | null; line_items: LineItem[]
  ai_fields: Record<string, unknown> | null; ai_source: 'gemini' | 'cache' | 'reuse' | 'manual'; ai_confidence: number | null; edited_fields: string[]
  risk_score: number | null; risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | null; risk_breakdown: RiskRow[] | null; risk_summary: string | null
  buyer_score: number | null; buyer_score_parts: { payment: number; delay: number; utilisation: number; newBuyer: boolean; reason: string } | null
  advance_pct: number | null; buyer_note: string | null; created_at: string; updated_at: string
}
export type CheckRow = { id: string; position: number; name: string; category: string; status: 'pass' | 'warn' | 'fail'; reason: string; detail: { invoice?: string; po?: string; receipt?: string } | null }
export type OfferRow = { invoice_id: string; advance_pct: number; advance_amount: number; fee_amount: number; reasons: string[]; status: 'released' | 'accepted'; accepted_at: string | null; created_at: string }
export type PoRow = { id: string; po_number: string; buyer_id: string; supplier_id: string; item: string; qty: number; unit_price: number; tax_rate: number; total: number; po_date: string; delivery_receipts: { grn_number: string; qty_delivered: number; delivered_on: string }[] }
export type AuditRow = { seq: number; invoice_id: string | null; event_type: string; payload: { summary: string; file_hash: string | null; record_hash: string | null }; payload_hash: string; prev_hash: string; entry_hash: string; ts: string }
export type Party = { id: string; type: 'supplier' | 'buyer'; name: string; city?: string | null; upi_id: string }

export function toUpiId(name?: string | null, email?: string | null): string {
  if (!name && !email) return 'business@invopay'
  const n = (name || '').toLowerCase().trim()
  if (n.includes('ravi')) return 'ravi@invopay'
  if (n.includes('peacock')) return 'peacock@invopay'
  if (n.includes('kaveri')) return 'kaveri@invopay'
  if (n.includes('banyan')) return 'banyan@invopay'
  if (n.includes('lotus')) return 'lotus@invopay'
  if (n.includes('newleaf')) return 'newleaf@invopay'
  if (email && email.includes('@')) {
    const handle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '')
    return `${handle}@invopay`
  }
  const clean = n.replace(/[^a-z0-9]/g, '')
  return `${clean || 'user'}@invopay`
}

/** numeric columns arrive as strings from PostgREST; the screens want numbers. */
export function toInvoice(r: Record<string, unknown>): InvoiceRow {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return { ...r, subtotal: n(r.subtotal), tax_amount: n(r.tax_amount), amount: n(r.amount), ai_confidence: n(r.ai_confidence) } as InvoiceRow
}

let partyCache: Promise<Map<string, Party>> | null = null
/** Every party's name (names are readable to signed-in users; identity columns are not). */
export function parties(fresh = false): Promise<Map<string, Party>> {
  if (fresh) partyCache = null
  partyCache ??= Promise.resolve(supabase.from('parties').select('id, type, name, city').order('name'))
    .then(({ data }) => new Map((data ?? []).map((p) => [p.id, { ...p, upi_id: toUpiId(p.name) } as Party])))
  return partyCache
}

export function useParties() {
  const [map, setMap] = useState<Map<string, Party>>(new Map())
  useEffect(() => { parties().then(setMap) }, [])
  return map
}

/** Invoices this user may see (RLS decides), kept fresh with Realtime. */
export function useInvoices() {
  const [rows, setRows] = useState<InvoiceRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
    if (e) setError('Could not load invoices. Pull to refresh or try again.')
    else { setRows((data ?? []).map(toInvoice)); setError(null) }
  }, [])
  useEffect(() => {
    load()
    const ch = supabase.channel('invoices-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])
  return { rows, error, reload: load }
}

export const STATUS_LABEL: Record<string, string> = {
  uploaded: 'Uploaded', extracted: 'Draft', checked: 'Checks passed', review: 'In review', approved: 'Approved',
  rejected: 'Rejected', offer_released: 'Offer released',
}

/** One plain-English sentence on where the invoice stands and what happens next. */
export function nextStep(inv: InvoiceRow): string {
  switch (inv.status) {
    case 'extracted': return 'Draft: check the fields against the document and submit.'
    case 'checked': return inv.buyer_status === 'confirmed' ? 'Buyer confirmed; releasing the offer.' : 'All checks passed. Waiting for the buyer to confirm the goods and the amount.'
    case 'review': return inv.buyer_status === 'disputed' ? 'The buyer disputed this invoice. A lender will review it.' : 'Some checks need a person: a lender will review it.'
    case 'approved': return inv.buyer_status === 'confirmed' ? 'Approved; releasing the offer.' : 'Approved by the lender. Waiting for the buyer to confirm.'
    case 'rejected': return 'Rejected: a hard rule failed. See the reasons below.'
    case 'offer_released': return 'Financing offer released.'
    default: return 'Uploaded.'
  }
}

/** Generic realtime list: loads with `query`, reloads whenever `table` changes (RLS still applies). */
function useLive<T>(table: string, query: () => PromiseLike<{ data: unknown; error: unknown }>, map: (r: Record<string, unknown>) => T) {
  const [rows, setRows] = useState<T[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const { data, error: e } = await query()
    if (e) setError('Could not load. Check your connection.')
    else { setRows(((data ?? []) as Record<string, unknown>[]).map(map)); setError(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])
  useEffect(() => {
    load()
    const ch = supabase.channel(`${table}-` + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, table])
  return { rows, error, reload: load }
}

export const usePOs = () => useLive<PoRow>('purchase_orders',
  () => supabase.from('purchase_orders').select('*, delivery_receipts(grn_number, qty_delivered, delivered_on)').order('created_at', { ascending: false }),
  (r) => ({ ...r, qty: Number(r.qty), unit_price: Number(r.unit_price), tax_rate: Number(r.tax_rate), total: Number(r.total),
    delivery_receipts: ((r.delivery_receipts ?? []) as PoRow['delivery_receipts']).map((d) => ({ ...d, qty_delivered: Number(d.qty_delivered) })) }) as PoRow)

export const useOffers = () => useLive<OfferRow>('financing_offers',
  () => supabase.from('financing_offers').select('*').order('created_at', { ascending: false }),
  (r) => ({ ...r, advance_amount: Number(r.advance_amount), fee_amount: Number(r.fee_amount) }) as OfferRow)

/** Where an invoice is on the road to cash: 0 uploaded · 1 checked · 2 buyer OK · 3 offer. -1 = stopped. */
export function stage(inv: InvoiceRow): number {
  if (inv.status === 'rejected') return -1
  if (inv.status === 'offer_released') return 3
  if (inv.buyer_status === 'confirmed') return 2
  if (['checked', 'review', 'approved'].includes(inv.status)) return 1
  return 0
}
