import { matchBuyer } from '@shared/fields.ts'
import type { InvoiceFields, Party } from '@shared/types.ts'
import { recognizeText } from './engine.ts'
import { parseInvoiceText } from './parser.ts'

export type LocalOcrResult = {
  fields: InvoiceFields
  confidence: number
  /** Fields the reader is not sure about (failed a format check, missing, or totals that don't add up). */
  uncertain: string[]
  buyer_id: string | null
  rawText: string
}

/**
 * Executes local OCR and rule-based extraction on an invoice file (image or PDF).
 * Fallback mechanism for when the Gemini AI API fails, times out, or has no key.
 */
export async function extractInvoiceLocally(file: File, buyers: Pick<Party, 'id' | 'name' | 'gstin'>[] = []): Promise<LocalOcrResult> {
  const rawText = await recognizeText(file)
  const { fields, confidence, uncertain } = parseInvoiceText(rawText)
  const buyer_id = matchBuyer(fields, buyers)

  return {
    fields,
    confidence,
    uncertain,
    buyer_id,
    rawText,
  }
}

export { parseInvoiceText } from './parser.ts'
export { recognizeText, renderPdfPage, terminateWorker } from './engine.ts'
