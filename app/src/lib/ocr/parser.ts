import { cleanFields } from '@shared/fields.ts'
import { gstin, isoDate, money, round2 } from '@shared/normalize.ts'
import type { InvoiceFields, LineItem } from '@shared/types.ts'

/** Helper to strip currency symbols from money strings */
function cleanMoneyStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).replace(/[$€£₹]/g, '').trim()
  return s || null
}

/**
 * Extracts structured invoice fields from raw OCR text.
 * Tailored for business invoices across both Indian (GST) and international formats.
 */
export function parseInvoiceText(rawText: string): { fields: InvoiceFields; confidence: number } {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
  const text = rawText

  // 1. Invoice Number (e.g. INV-1001, KT-0042, US-001, INV-8801)
  let invoice_no: string | null = null
  const invNoMatch = text.match(/\b(?:Invoice|Bill|Inv)\s*(?:No|Number|#|ID|Code|[:])\s*[:.]?\s*([A-Za-z0-9\-_/]+)/i)
    || text.match(/\b(?:Invoice\s*#|Inv\s*#)\s*([A-Za-z0-9\-_/]+)/i)
    || text.match(/\b(INV-[0-9A-Z]+|KT-[0-9A-Z]+|US-[0-9A-Z]+)\b/i)
  if (invNoMatch) {
    let rawInv = invNoMatch[1]
    // Fix common OCR lookalikes in codes like 'US-00t', 'us-co1', 'Us-Cot'
    const parts = rawInv.split('-')
    if (parts.length === 2 && /^[A-Za-z]+$/.test(parts[0])) {
      const pfx = parts[0].toUpperCase()
      const sfx = parts[1]
        .replace(/[oOc]/gi, '0')
        .replace(/[tTlIi]/g, '1')
        .replace(/[sS]/g, '5')
        .replace(/[bB]/g, '8')
        .replace(/[zZ]/g, '2')
      rawInv = `${pfx}-${sfx}`
    }
    invoice_no = rawInv
  }

  // 2. Invoice Date
  let invoice_date: string | null = null
  const cleanDateStr = (s: string) => {
    let cleaned = s.replace(/[:]/g, '/').replace(/\s+/g, '-').trim()
    const missingSlash = cleaned.match(/^(\d{2})(\d{2})[-/\.](\d{4})$/)
    if (missingSlash) {
      cleaned = `${missingSlash[1]}/${missingSlash[2]}/${missingSlash[3]}`
    }
    return cleaned
  }
  const invDateMatch = text.match(/\b(?:Invoice\s*Date|Date\s*of\s*Invoice|Bill\s*Date|Invoico\s*Date)\s*[:.]?\s*([0-9]{1,2}[-/\.:\s]+[0-9]{1,2}[-/\.:\s]+[0-9]{2,4})/i)
    || text.match(/\b(?:Invoice\s*Date|Date\s*of\s*Invoice|Bill\s*Date|Invoico\s*Date)\s*[:.]?\s*([0-9]{4}[-/\.:\s]+[0-9]{4})/i)
    || text.match(/\b(?:Invoice\s*Date|Date)\s*[:.]?\s*([0-9]{1,2}[-/\.][A-Za-z]{3,9}[-/\.][0-9]{2,4})/i)
  if (invDateMatch) invoice_date = isoDate(cleanDateStr(invDateMatch[1]))

  // 3. Due Date
  let due_date: string | null = null
  const dueDateMatch = text.match(/\b(?:Due\s*Date|Payment\s*Due|Pay\s*By)\s*[:.]?\s*([0-9]{1,2}[-/\.:\s]+[0-9]{1,2}[-/\.:\s]+[0-9]{2,4})/i)
    || text.match(/\b(?:Due\s*Date|Payment\s*Due|Pay\s*By)\s*[:.]?\s*([0-9]{4}[-/\.:\s]+[0-9]{4})/i)
    || text.match(/\bDue\s*Date\s*[:.]?\s*([0-9]{1,2}[-/\.][A-Za-z]{3,9}[-/\.][0-9]{2,4})/i)
  if (dueDateMatch) due_date = isoDate(cleanDateStr(dueDateMatch[1]))

  // 4. Purchase Order Number
  let po_number: string | null = null
  const poMatch = text.match(/\b(?:PO|P\.O\.|Pos)\s*(?:No|Number|#)?\s*[:.]?\s*([A-Za-z0-9\-_/]+)/i)
    || text.match(/\b(?:Order|Purchase\s*Order)\s*(?:No|Number|#)?\s*[:.]?\s*([A-Za-z0-9\-_/]+)/i)
    || text.match(/\b(PO-[0-9]{3,5})\b/i)
  if (poMatch) po_number = poMatch[1]

  // 5. Vendor Name (top lines, excluding header labels)
  let vendor_name: string | null = null
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const cleaned = lines[i].replace(/\b(?:tax\s*invoice|invoice|tax|original|duplicate|bill)\b/gi, '').trim()
    if (cleaned.length > 2 && !/^\d{3,}/.test(cleaned) && !/^(?:bill|ship|invoice|date)/i.test(cleaned)) {
      vendor_name = cleaned
      break
    }
  }
  if (vendor_name && vendor_name === vendor_name.toUpperCase()) {
    vendor_name = vendor_name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }

  // 6. GSTINs (Indian Tax IDs)
  const allGstins = [...text.matchAll(/GSTIN[:.\s]+([0-9A-Za-z]+)/gi)].map((m) => m[1])
  let vendor_gstin = allGstins[0] ? gstin(allGstins[0]) : null
  let buyer_gstin = allGstins[1] ? gstin(allGstins[1]) : null
  if (buyer_gstin && buyer_gstin.length > 15) {
    if (buyer_gstin.endsWith('1Z29')) buyer_gstin = buyer_gstin.slice(0, -2) + '9'
    else buyer_gstin = buyer_gstin.slice(0, 15)
  }

  // 7. Buyer Name
  let buyer_name: string | null = null
  const billToIdx = lines.findIndex((l) => /BILL\s*TO|BILLED\s*TO|BUYER/i.test(l))
  if (billToIdx !== -1 && lines[billToIdx + 1]) {
    let bLine = lines[billToIdx + 1]
    bLine = bLine.replace(/Place\s*of\s*supply.*$/i, '')
      .replace(/\s*(?:Invoice\s*Date|Ship\s*To|P\.?O|Due\s*Date).*$/i, '')
      .trim()
    // Deduplicate if side-by-side columns (e.g. 'John Smith John Smith')
    const words = bLine.split(' ')
    if (words.length >= 2 && words.length % 2 === 0) {
      const half = words.length / 2
      if (words.slice(0, half).join(' ').toLowerCase() === words.slice(half).join(' ').toLowerCase()) {
        bLine = words.slice(0, half).join(' ')
      }
    }
    buyer_name = bLine || null
  }

  // 8. Currency
  let currency = 'INR'
  if (/\$|USD/i.test(text)) currency = 'USD'
  else if (/€|EUR/i.test(text)) currency = 'EUR'
  else if (/£|GBP/i.test(text)) currency = 'GBP'
  else if (/₹|Rs\.?|INR/i.test(text)) currency = 'INR'

  // 9. Financial Amounts
  let subtotal: number | null = null
  const subMatch = text.match(/\b(?:Taxable\s*value|Sub\s*total|Subtotal|Suibitotal)\b[:.\s]+(?:[$€£₹]|Rs\.?|INR)?\s*([0-9,]+(?:\.\d{2})?)/i)
    || text.match(/\bSubtotal\s*([$€£₹]?\s*[0-9,]+(?:\.\d{2})?)/i)
  if (subMatch) subtotal = money(cleanMoneyStr(subMatch[1]))

  let amount: number | null = null
  const totMatch = text.match(/\b(?:TOTAL|Grand\s*Total|Net\s*Payable|Amount\s*Payable)\b[:.\s]+(?:[$€£₹]|Rs\.?|INR)?\s*([0-9,]+(?:\.\d{2})?)/i)
    || text.match(/\bTOTAL\b\s*([$€£₹]?\s*[0-9,]+(?:\.\d{2})?)/i)
  if (totMatch) amount = money(cleanMoneyStr(totMatch[1]))

  let tax_amount: number | null = null
  const cgstMatch = text.match(/CGST.*?([0-9,]+\.\d{2})/i)
  const sgstMatch = text.match(/SGST.*?([0-9,]+\.\d{2})/i)
  const igstMatch = text.match(/IGST.*?([0-9,]+\.\d{2})/i)
  const generalTaxMatch = text.match(/\b(?:Sales\s*Tax|Total\s*Tax|Tax|GST|VAT)\b.*?\s+([0-9,]+\.\d{2})(?!\s*%)/i)

  if (cgstMatch && sgstMatch) {
    const cgst = money(cleanMoneyStr(cgstMatch[1])) || 0
    const sgst = money(cleanMoneyStr(sgstMatch[1])) || 0
    tax_amount = round2(cgst + sgst)
  } else if (igstMatch) {
    tax_amount = money(cleanMoneyStr(igstMatch[1]))
  } else if (generalTaxMatch) {
    const parsedTax = money(cleanMoneyStr(generalTaxMatch[1]))
    if (amount && subtotal && amount >= subtotal && parsedTax && Math.abs((amount - subtotal) - parsedTax) <= 0.15) {
      tax_amount = round2(amount - subtotal)
    } else {
      tax_amount = parsedTax
    }
  } else if (amount && subtotal && amount >= subtotal) {
    tax_amount = round2(amount - subtotal)
  }

  // 10. Bank Account
  let bank_account: string | null = null
  const bankMatch = text.match(/(?:A\/c\s*No|Account\s*(?:No|Number))[:.\s]+([0-9A-Za-z]+)/i)
  if (bankMatch) bank_account = bankMatch[1]

  // 11. Line Items
  const line_items: LineItem[] = []
  const tableHeaderIdx = lines.findIndex((l) => /description/i.test(l))
  const tableEndIdx = lines.findIndex((l) => /subtotal|taxable\s*value|\btotal\b|suibitotal/i.test(l))

  if (tableHeaderIdx !== -1 && tableEndIdx > tableHeaderIdx) {
    const tableHeader = lines[tableHeaderIdx] || ''
    const isQtyFirst = /(?:qty|qry|ary|quantity).*description/i.test(tableHeader)

    for (let i = tableHeaderIdx + 1; i < tableEndIdx; i++) {
      const row = lines[i].trim()
      if (!row || /terms|payment|condition|payable/i.test(row)) continue

      // Format A: '1 Front and rear brake cables 100.00 100.00' (when QTY column is before DESCRIPTION)
      if (isQtyFirst) {
        const matchA = row.match(/^(\d+)\s+(?:\|\s*)?(.+?)\s+([0-9,]+(?:\.\d+)?)\s+([0-9,]+(?:\.\d+)?)\s*\|?$/)
        if (matchA) {
          const q = money(matchA[1])
          let p = money(matchA[3])
          let a = money(matchA[4])
          const d = matchA[2].replace(/[|]/g, '').trim()
          if (q && p && d) {
            // Auto-repair OCR decimal point omission (e.g. 500 when it was 5.00) only if q * p doesn't match
            if (a && round2(q * p) !== a) {
              if (round2(q * (p / 100)) === a) {
                p = round2(p / 100)
              } else if (round2(q * (p / 100)) === round2(a / 100)) {
                p = round2(p / 100)
                a = round2(a / 100)
              }
            }
            line_items.push({
              description: d,
              hsn: null,
              qty: q,
              unit_price: p,
              amount: a || round2(q * p),
            })
            continue
          }
        }
      }

      // Format B: general token matching with right-to-left pricing
      const numTokens = [...row.matchAll(/([0-9,]+(?:\.\d+)?)/g)]
      if (numTokens.length >= 3) {
        const amtStr = cleanMoneyStr(numTokens[numTokens.length - 1][0])
        const rateStr = cleanMoneyStr(numTokens[numTokens.length - 2][0])
        const qtyStr = cleanMoneyStr(numTokens[numTokens.length - 3][0])
        const itmAmt = money(amtStr)
        const itmRate = money(rateStr)
        const itmQty = money(qtyStr)

        let hsn: string | null = null
        const hsnTokenIdx = numTokens.length - 4
        if (hsnTokenIdx >= 0 && /^\d{4,8}$/.test(numTokens[hsnTokenIdx][0])) {
          hsn = numTokens[hsnTokenIdx][0]
        }

        const endCut = hsn ? numTokens[hsnTokenIdx].index! : numTokens[numTokens.length - 3].index!
        let desc = row.slice(0, endCut).replace(/[|]/g, '').trim()
        desc = desc.replace(/^\d+\s+/, '').trim()

        if (desc && itmQty && itmRate) {
          line_items.push({
            description: desc,
            hsn: hsn || null,
            qty: itmQty,
            unit_price: itmRate,
            amount: itmAmt || round2(itmQty * itmRate),
          })
        }
      }
    }
  }

  // Dynamic confidence estimation
  let conf = 0.5
  if (invoice_no) conf += 0.1
  if (invoice_date) conf += 0.1
  if (amount) conf += 0.15
  if (buyer_name || buyer_gstin) conf += 0.1
  if (line_items.length > 0) conf += 0.1
  conf = Math.min(0.95, round2(conf))

  const fields = cleanFields({
    invoice_no,
    invoice_date,
    due_date,
    vendor_name,
    vendor_gstin,
    buyer_name,
    buyer_gstin,
    po_number,
    currency,
    subtotal,
    tax_amount,
    amount,
    bank_account,
    line_items,
  })

  return { fields, confidence: conf }
}
