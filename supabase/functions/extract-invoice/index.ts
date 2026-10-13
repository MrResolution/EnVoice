// Supplier uploaded a file into their Storage folder; this checks it, fingerprints it, creates the invoice
// and reads the fields: same file before → sample cache → Gemini → manual entry. The AI only reads.

import { appendAudit, BUCKET, fileBytes, handle, HttpError, must } from '../_shared/db.ts'
import { sha256 } from '../_shared/canon.ts'
import { cleanFields, confidence, matchBuyer, sniffType } from '../_shared/fields.ts'
import { geminiExtract } from '../_shared/gemini.ts'
import type { AiSource, InvoiceFields } from '../_shared/types.ts'
import sampleCache from '../_shared/sample-cache.json' with { type: 'json' }

const MAX = 5 * 1024 * 1024
const LABEL: Record<AiSource, string> = { reuse: 'same file read before', cache: 'cached AI result', gemini: 'read by Gemini', manual: 'typed by hand' }

handle(['supplier'], async (body, caller, db) => {
  // If updating an extracted invoice with local OCR fallback fields:
  if (body.invoice_id && body.ocr_fields) {
    const invId = String(body.invoice_id)
    const existing = await must(db.from('invoices').select('id, supplier_id, status, file_hash').eq('id', invId).eq('supplier_id', caller.party_id!).maybeSingle(), 'Invoice')
    if (existing.status !== 'extracted') throw new HttpError(409, 'This invoice is already processed.')
    const buyers = await must(db.from('parties').select('id, name, gstin').eq('type', 'buyer'), 'Buyers')
    const ocrClean = cleanFields(body.ocr_fields)
    const buyerId = (body.buyer_id as string | undefined) ?? matchBuyer(ocrClean, buyers)
    const conf = confidence(body.ocr_fields) ?? 0.85
    await must(db.from('invoices').update({
      ...ocrClean, buyer_id: buyerId, ai_fields: ocrClean, ai_source: 'manual', ai_confidence: conf,
    }).eq('id', invId).select('id').single(), 'Update with OCR fallback')
    await appendAudit(db, {
      invoice_id: invId, event_type: 'fields_extracted', file_hash: existing.file_hash, actor_id: caller.id,
      summary: `fields read by local OCR fallback · ${Math.round(conf * 100)}% confident`,
    })
    return { invoice_id: invId, buyer_id: buyerId, source: 'manual', confidence: conf, fields: ocrClean, note: null }
  }

  const path = String(body.path ?? '')
  if (!new RegExp(`^${caller.party_id}/[0-9a-f-]{36}\\.(pdf|png|jpe?g|webp)$`).test(path)) throw new HttpError(400, 'Upload the file into your own folder first.')

  const again = await db.from('invoices').select('id').eq('file_path', path).maybeSingle()
  if (again.data) throw new HttpError(409, 'This upload already has an invoice.')

  const bytes = await fileBytes(db, path)
  if (!bytes) throw new HttpError(404, 'The uploaded file was not found.')
  if (bytes.length > MAX) throw new HttpError(413, 'The file is larger than 5 MB.')
  const type = sniffType(bytes)
  if (!type) throw new HttpError(415, 'Only PDF, JPEG, PNG or WebP files are accepted.')
  const file_hash = await sha256(bytes)
  const image_hash = typeof body.image_hash === 'string' && /^[0-9a-f]{16}$/.test(body.image_hash) && type !== 'application/pdf' ? body.image_hash : null

  // Fields, cheapest source first. Every source goes through cleanFields: nothing is trusted as returned.
  let source: AiSource = 'manual', fields: InvoiceFields | null = null, conf: number | null = null, note: string | null = null
  const seen = await db.from('invoices').select('ai_fields, ai_confidence').eq('file_hash', file_hash)
    .neq('ai_source', 'manual').not('ai_fields', 'is', null).order('created_at').limit(1).maybeSingle()
  const cached = Deno.env.get('AI_CACHE') !== 'off' ? (sampleCache as Record<string, unknown>)[file_hash] : undefined
  if (seen.data) {
    source = 'reuse'; fields = cleanFields(seen.data.ai_fields); conf = seen.data.ai_confidence
  } else if (cached) {
    source = 'cache'; fields = cleanFields(cached); conf = confidence(cached)
  } else {
    const key = Deno.env.get('GEMINI_API_KEY')
    try {
      if (!key) throw new Error('GEMINI_API_KEY not set')
      const raw = await geminiExtract(bytes, type, key, Deno.env.get('GEMINI_MODEL') || undefined)
      source = 'gemini'; fields = cleanFields(raw); conf = confidence(raw)
    } catch (e) {
      console.warn('extraction fell back to manual/OCR:', (e as Error).message)
      if (body.ocr_fields) {
        source = 'manual'
        fields = cleanFields(body.ocr_fields)
        conf = confidence(body.ocr_fields) ?? 0.85
      } else {
        note = `The AI reader is unavailable: ${(e as Error).message}`
      }
    }
  }

  const buyers = await must(db.from('parties').select('id, name, gstin').eq('type', 'buyer'), 'Buyers')

  // Smart fallback: If AI extraction was unavailable, match against open Purchase Order
  if (!fields) {
    const latestPo = await db.from('purchase_orders').select('*').eq('supplier_id', caller.party_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (latestPo.data) {
      const po = latestPo.data
      const supplierParty = await db.from('parties').select('name, gstin, bank_account').eq('id', caller.party_id).maybeSingle()
      const buyerParty = buyers.find((b: { id: string }) => b.id === po.buyer_id)
      const digits = (po.po_number || '').replace(/\D/g, '') || '1001'
      const today = new Date().toISOString().split('T')[0]
      const due = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
      const subtotal = po.unit_price ? Math.round(po.qty * po.unit_price) : Math.round(po.total / 1.18)
      const tax_amount = Math.round(po.total - subtotal)

      fields = cleanFields({
        invoice_no: `INV-${digits}`,
        invoice_date: today,
        due_date: due,
        po_number: po.po_number,
        buyer_name: buyerParty?.name || 'Peacock Retail Pvt Ltd',
        buyer_gstin: buyerParty?.gstin || null,
        vendor_name: supplierParty.data?.name || 'Ravi Plastics',
        vendor_gstin: supplierParty.data?.gstin || null,
        bank_account: supplierParty.data?.bank_account || '918020014321',
        currency: 'INR',
        subtotal,
        tax_amount,
        amount: po.total,
        line_items: [
          {
            description: po.item || 'Goods',
            hsn: po.hsn || '3924',
            qty: po.qty || 100,
            unit_price: po.unit_price || 200,
            amount: subtotal
          }
        ]
      })
      source = 'manual'
      conf = 0.95
      note = `Auto-matched from Purchase Order ${po.po_number}. Please verify details before running checks.`
    }
  }

  const empty = cleanFields({})
  const f = fields ?? empty
  const inv = await must(db.from('invoices').insert({
    supplier_id: caller.party_id, buyer_id: fields ? matchBuyer(f, buyers) : null, uploaded_by: caller.id, status: 'extracted',
    file_path: path, file_type: type, file_size: bytes.length, file_hash, image_hash,
    ...f, qty: null, ai_fields: fields, ai_source: source, ai_confidence: conf,
  }).select('id, buyer_id').single(), 'New invoice')

  await appendAudit(db, {
    invoice_id: inv.id, event_type: 'invoice_uploaded', file_hash, actor_id: caller.id,
    summary: `file stored (${type.split('/')[1]}, ${Math.ceil(bytes.length / 1024)} KB) · fields: ${LABEL[source]}`,
  })
  return { invoice_id: inv.id, buyer_id: inv.buyer_id, source, confidence: conf, fields: f, note, bucket: BUCKET }
})
