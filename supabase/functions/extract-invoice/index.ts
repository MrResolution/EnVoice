// Supplier uploaded a file into their Storage folder; this checks it, fingerprints it, creates the invoice
// and reads the fields: same file read before → sample cache → Gemini → (on-device reader) → manual entry.
// The AI only reads. Nothing here ever fills an invoice from the purchase order: the invoice is what gets
// compared WITH the purchase order, so copying the PO into it would make every three-way match pass.

import { appendAudit, BUCKET, fileBytes, handle, HttpError, must } from '../_shared/db.ts'
import { sha256 } from '../_shared/canon.ts'
import { cleanFields, confidence, matchBuyer, sniffType } from '../_shared/fields.ts'
import { GEMINI_REASON, GeminiError, geminiExtract } from '../_shared/gemini.ts'
import type { AiSource, InvoiceFields } from '../_shared/types.ts'
import sampleCache from '../_shared/sample-cache.json' with { type: 'json' }

const MAX = 5 * 1024 * 1024
const LABEL: Record<AiSource, string> = {
  reuse: 'same file read before', cache: 'cached AI result', gemini: 'read by Gemini', ocr: "read on the seller's device", manual: 'typed by hand',
}

handle(['supplier'], async (body, caller, db) => {
  // Second step, only when the server could not read the file: the app read it on the device (Tesseract) and
  // sends what it found. That is the seller's own reading, so it is stored as source "ocr" and always reviewed.
  if (body.invoice_id && body.ocr_fields) {
    const id = String(body.invoice_id)
    const inv = await must(db.from('invoices').select('id, status, ai_source').eq('id', id).eq('supplier_id', caller.party_id!).maybeSingle(), 'Invoice')
    if (inv.status !== 'extracted') throw new HttpError(409, 'This invoice was already submitted.')
    if (inv.ai_source !== 'manual') throw new HttpError(409, 'The server already read this invoice.')
    const fields = cleanFields(body.ocr_fields)
    const conf = confidence({ confidence: body.ocr_confidence }) ?? 0.6 // the reader's own estimate; checks still send it to review
    const buyers = await must(db.from('parties').select('id, name, gstin').eq('type', 'buyer'), 'Buyers')
    const buyer_id = matchBuyer(fields, buyers)
    await must(db.from('invoices').update({ ...fields, qty: null, buyer_id, ai_fields: fields, ai_source: 'ocr', ai_confidence: conf })
      .eq('id', id).select('id').single(), 'Saving the device reading')
    return { invoice_id: id, buyer_id, source: 'ocr', confidence: conf, fields, note: null }
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
  // Only readings the SERVER made are reused (a device reading is the seller's claim, not evidence).
  let source: AiSource = 'manual', fields: InvoiceFields | null = null, conf: number | null = null
  let note: string | null = null, ai_reason: string | null = null
  const seen = await db.from('invoices').select('ai_fields, ai_confidence').eq('file_hash', file_hash)
    .in('ai_source', ['gemini', 'cache']).not('ai_fields->>invoice_no', 'is', null).order('created_at').limit(1).maybeSingle()
  const cached = Deno.env.get('AI_CACHE') !== 'off' ? (sampleCache as Record<string, unknown>)[file_hash] : undefined
  if (seen.data) {
    source = 'reuse'; fields = cleanFields(seen.data.ai_fields); conf = seen.data.ai_confidence
  } else if (cached) {
    source = 'cache'; fields = cleanFields(cached); conf = confidence(cached)
  } else {
    try {
      const { raw, model } = await geminiExtract(bytes, type, Deno.env.get('GEMINI_API_KEY'), Deno.env.get('GEMINI_MODEL') || undefined)
      const read = cleanFields(raw)
      if (read.invoice_no || read.amount !== null) { source = 'gemini'; fields = read; conf = confidence(raw); console.log(`read by ${model}`) }
      else { ai_reason = 'unreadable'; note = GEMINI_REASON.unreadable } // an empty reading is no reading: let the device try
    } catch (e) {
      const reason = e instanceof GeminiError ? e.reason : 'down'
      console.warn('Gemini unavailable:', (e as Error).message)
      ai_reason = reason
      note = GEMINI_REASON[reason]
    }
  }

  const buyers = await must(db.from('parties').select('id, name, gstin').eq('type', 'buyer'), 'Buyers')
  const f = fields ?? cleanFields({})
  const inv = await must(db.from('invoices').insert({
    supplier_id: caller.party_id, buyer_id: fields ? matchBuyer(f, buyers) : null, uploaded_by: caller.id, status: 'extracted',
    file_path: path, file_type: type, file_size: bytes.length, file_hash, image_hash,
    ...f, qty: null, ai_fields: fields, ai_source: source, ai_confidence: conf,
  }).select('id, buyer_id').single(), 'New invoice')

  await appendAudit(db, {
    invoice_id: inv.id, event_type: 'invoice_uploaded', file_hash, actor_id: caller.id,
    summary: `file stored (${type.split('/')[1]}, ${Math.ceil(bytes.length / 1024)} KB) · fields: ${fields ? LABEL[source] : 'not read by the server'}`,
  })
  return { invoice_id: inv.id, buyer_id: inv.buyer_id, source, confidence: conf, fields: f, note, ai_reason, bucket: BUCKET }
})
