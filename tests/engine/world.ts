// Test helpers: build engine inputs from samples/world.json, the same data the seed and images use.
import world from '../../samples/world.json' with { type: 'json' }
import manifest from '../../samples/manifest.json' with { type: 'json' }
import type { Ctx, DeliveryReceipt, Invoice, InvoiceFields, Party, PurchaseOrder } from '../../supabase/functions/_shared/types.ts'
import { ref } from '../../supabase/functions/_shared/normalize.ts'

type Sample = { key: string; supplier?: string; buyer?: string; copy_of?: string; fields?: InvoiceFields }

export const parties = new Map(world.parties.map((p) => [p.key, p as unknown as Party]))
const byId = new Map(world.parties.map((p) => [p.id, p as unknown as Party]))
export const pos: PurchaseOrder[] = world.purchase_orders.map((p) => ({
  ...p, buyer_id: parties.get(p.buyer)!.id, supplier_id: parties.get(p.supplier)!.id,
}))
const receipts: DeliveryReceipt[] = world.delivery_receipts.map((r) => ({ ...r, po_id: pos.find((p) => p.key === r.po)!.id } as unknown as DeliveryReceipt))
const samples = new Map((world.samples as Sample[]).map((s) => [s.key, s]))

export function invoiceFor(key: string, createdAt = '2026-10-13T05:00:00Z', patch: Partial<Invoice> = {}): Invoice {
  const s = samples.get(key)!
  const base = s.copy_of ? samples.get(s.copy_of)! : s
  const m = (manifest as Record<string, { sha256: string; image_hash: string }>)[key]
  return {
    ...structuredClone(base.fields!),
    id: `inv-${key}`, supplier_id: parties.get(base.supplier!)!.id, buyer_id: parties.get(base.buyer!)!.id,
    status: 'extracted', file_hash: m.sha256, image_hash: m.image_hash,
    ai_source: 'cache', ai_confidence: 0.97, ai_fields: structuredClone(base.fields!), edited_fields: [], created_at: createdAt,
    ...patch,
  }
}

export function ctxFor(invoice: Invoice, others: Invoice[]): Ctx {
  const po = pos.find((p) => p.buyer_id === invoice.buyer_id && p.supplier_id === invoice.supplier_id && ref(p.po_number) === ref(invoice.po_number)) ?? null
  return {
    invoice, others,
    supplier: byId.get(invoice.supplier_id)!,
    buyer: invoice.buyer_id ? byId.get(invoice.buyer_id) ?? null : null,
    po, receipt: po ? receipts.find((r) => r.po_id === po.id) ?? null : null,
  }
}
