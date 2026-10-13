import { matchBuyer } from '@shared/fields.ts'
import type { InvoiceFields, Party } from '@shared/types.ts'
import { recognizeText } from './engine.ts'
import { parseInvoiceText } from './parser.ts'

export type LocalOcrResult = {
  fields: InvoiceFields
  confidence: number
  buyer_id: string | null
  rawText: string
}

/**
 * Executes local OCR and rule-based extraction on an invoice file (image or PDF).
 * Fallback mechanism for when the Gemini AI API fails, times out, or has no key.
 *
 * Tier 1: Local GPU-accelerated Pretrained Donut/Vision model on http://127.0.0.1:8000 (if active).
 * Tier 2: In-browser offline Tesseract LSTM WASM engine (always available, 0 network required).
 */
export async function extractInvoiceLocally(file: File, buyers: Pick<Party, 'id' | 'name' | 'gstin'>[] = []): Promise<LocalOcrResult> {
  // 1. Check for local GPU Document AI service on localhost:8000
  try {
    const probe = await fetch('http://127.0.0.1:8000/health', { signal: AbortSignal.timeout(500) })
    if (probe.ok) {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('http://127.0.0.1:8000/api/extract', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.fields && (data.fields.invoice_no || data.fields.amount)) {
          const rawText = await recognizeText(file).catch(() => '')
          const parsedRule = rawText ? parseInvoiceText(rawText) : null
          const mergedFields: InvoiceFields = {
            ...(parsedRule ? parsedRule.fields : {}),
            ...data.fields,
            line_items: (data.fields.line_items?.length ? data.fields.line_items : parsedRule?.fields?.line_items) ?? [],
          }
          const buyer_id = matchBuyer(mergedFields, buyers)
          return {
            fields: mergedFields,
            confidence: Math.max(data.confidence ?? 0.92, parsedRule?.confidence ?? 0.85),
            buyer_id,
            rawText: rawText || JSON.stringify(data.raw_parsed ?? {}),
          }
        }
      }
    }
  } catch {
    // GPU microservice offline or unreachable, fall through cleanly to in-browser engine
  }

  // 2. Client-side offline fallback (Tesseract LSTM WASM + deterministic parser)
  const rawText = await recognizeText(file)
  const { fields, confidence } = parseInvoiceText(rawText)
  const buyer_id = matchBuyer(fields, buyers)

  return {
    fields,
    confidence,
    buyer_id,
    rawText,
  }
}

export { parseInvoiceText } from './parser.ts'
export { recognizeText, renderPdfPage, terminateWorker } from './engine.ts'
