// The on-device reader's "model": turns raw OCR text into invoice fields using what we know about Indian GST
// invoices (GSTIN shape, label vocabulary, PO numbering, Indian number grouping).
// It repairs CHARACTERS that OCR confuses (Z/2, O/0, S/5, B/8…) where the format says which kind belongs there.
// It never repairs ARITHMETIC: if lines + tax ≠ total, that is reported as uncertain, not "fixed", because an
// edited total is exactly what the checks must see (S6).
import { cleanFields } from '@shared/fields.ts'
import { gstin as normGstin, isoDate, money, round2 } from '@shared/normalize.ts'
import type { InvoiceFields, LineItem } from '@shared/types.ts'

export type ParsedInvoice = { fields: InvoiceFields; confidence: number; uncertain: string[] }

const TO_DIGIT: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', i: '1', L: '1', '|': '1', Z: '2', z: '2', S: '5', s: '5', B: '8', G: '6', b: '6', T: '7', A: '4', g: '9', q: '9' }
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G', '7': 'T', '4': 'A', '9': 'G' }
const digitsOnly = (s: string) => s.replace(/./g, (c) => TO_DIGIT[c] ?? c)

/** 2 digits (state) · 5 letters + 4 digits + 1 letter (PAN) · entity · 'Z' · check character. */
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/

/** Puts each GSTIN position back into the class it must be (digit or letter). null if it can't be made valid. */
export function repairGstin(raw: string): string | null {
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (s.length === 16 && /^Z2[0-9A-Z]$/.test(s.slice(13))) s = s.slice(0, 14) + s.slice(15) // "…1Z29": the Z was read as "Z2"
  if (s.length > 15) s = s.slice(0, 15)
  if (s.length !== 15) return null
  const c = s.split('')
  for (const i of [0, 1, 7, 8, 9, 10]) c[i] = TO_DIGIT[c[i]] ?? c[i]
  for (const i of [2, 3, 4, 5, 6, 11]) c[i] = TO_LETTER[c[i]] ?? c[i]
  if (c[13] === '2' || c[13] === '7') c[13] = 'Z'
  const out = c.join('')
  return GSTIN_RE.test(out) ? out : null
}

/** "PO-4501", "Po4501", "Pos104" (5 read as s) → "PO-4501" / "PO-5104". Other PO styles are kept as printed. */
export function normalizePo(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/^P[O0][-\s.]?([0-9OoIlSsBZ]{3,})$/i)
  return m ? `PO-${digitsOnly(m[1])}` : raw
}

/** A money token with OCR slips repaired ("18,305.1O" → 18305.10). Needs at least two real digits. */
function num(token: string | undefined | null): number | null {
  if (!token) return null
  const t = token.replace(/[$€£₹\s]/g, '').replace(/^Rs\.?/i, '')
  if ((t.match(/\d/g) ?? []).length < 2) return money(t)
  return money(t.replace(/[OoIlSB]/g, (c) => TO_DIGIT[c] ?? c))
}
const MONEY_TOKEN = /([0-9OoIlSB][0-9OoIlSB,]*(?:\.[0-9OoIl]{1,2})?)/g
/** The last money-looking token on a line (totals print the amount at the right edge). */
function lastMoney(line: string): number | null {
  const tokens = [...line.matchAll(MONEY_TOKEN)].map((m) => m[1]).filter((t) => /\d/.test(t) && !/%$/.test(t))
  for (let i = tokens.length - 1; i >= 0; i--) { const v = num(tokens[i]); if (v !== null) return v }
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
/** "10-0ct-2026", "1O/1O/2026", "1102/2019" → ISO, tolerating OCR slips in each part. */
function readDate(raw: string | undefined): string | null {
  if (!raw) return null
  let s = raw.trim().replace(/[:]/g, '/').replace(/\s+/g, '-')
  const glued = s.match(/^(\d{2})(\d{2})[-/.](\d{4})$/) // "1102/2019": OCR lost a slash
  if (glued) s = `${glued[1]}/${glued[2]}/${glued[3]}`
  const parts = s.split(/[-/.,]+/).filter(Boolean)
  if (parts.length === 3) {
    const [d, m, y] = parts
    const month = /[A-Za-z]/.test(m) ? m.toLowerCase().replace(/[0-9]/g, (c) => (TO_LETTER[c] ?? c).toLowerCase()) : digitsOnly(m)
    const fixedMonth = /^[a-z]+$/.test(month) && MONTHS.includes(month.slice(0, 3)) ? month.slice(0, 3) : month
    const iso = isoDate(`${digitsOnly(d)}-${fixedMonth}-${digitsOnly(y)}`) ?? isoDate(`${digitsOnly(d)}/${fixedMonth}/${digitsOnly(y)}`)
    if (iso) return iso
  }
  return isoDate(s)
}
const DATE_TOKEN = '([0-9OoIl]{1,2}[-/.:\\s]+[A-Za-z0-9]{2,9}[-/.:\\s,]+[0-9OoIl]{2,4}|[0-9]{4}[-/.][0-9]{2}[-/.][0-9]{2}|[0-9]{4}[-/.:\\s]+[0-9]{4})'
function dateAfter(text: string, labels: string): string | null {
  const m = text.match(new RegExp(`\\b(?:${labels})\\b\\s*[:.\\-]?\\s*${DATE_TOKEN}`, 'i'))
  return m ? readDate(m[1]) : null
}

export function parseInvoiceText(rawText: string): ParsedInvoice {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
  const text = lines.join('\n')
  const uncertain: string[] = []

  // 1. Invoice number. "PREFIX-SUFFIX" codes get look-alikes repaired in the numeric part (us-co1 → US-001).
  let invoice_no: string | null = null
  const invNoMatch = text.match(/\b(?:Invoice|Bill|Inv)\s*(?:No|Number|#|ID|Code|[:])\s*[:.]?\s*([A-Za-z0-9\-_/]+)/i)
    || text.match(/\b(?:Invoice\s*#|Inv\s*#)\s*([A-Za-z0-9\-_/]+)/i)
    || text.match(/\b(INV-[0-9A-Z]+|KT-[0-9A-Z]+|US-[0-9A-Z]+)\b/i)
  if (invNoMatch) {
    let rawInv = invNoMatch[1]
    const parts = rawInv.split('-')
    if (parts.length === 2 && /^[A-Za-z]+$/.test(parts[0])) {
      const sfx = parts[1].replace(/[oOcC]/g, '0').replace(/[tTlIi]/g, '1').replace(/[sS]/g, '5').replace(/[bB]/g, '8').replace(/[zZ]/g, '2')
      rawInv = `${parts[0].toUpperCase()}-${sfx}`
    }
    invoice_no = rawInv
  }

  // 2–3. Dates by label. A bare "Date" never matches inside "Due Date" (that mistake swapped the two dates).
  const invoice_date = dateAfter(text, 'Invoice\\s*Date|Inv\\.?\\s*Date|Date\\s*of\\s*Invoice|Bill\\s*Date|Invoico\\s*Date|Dated')
    ?? dateAfter(text, '(?<!Due\\s)(?<!Due)Date')
  const due_date = dateAfter(text, 'Due\\s*Date|Payment\\s*Due|Pay\\s*By|Due\\s*On')

  // 4. Purchase order number.
  const poMatch = text.match(/\b(?:PO|P\.O\.|Pos)\s*(?:No|Number|#)?\s*[:.]?\s*([A-Za-z0-9\-_/]+)/i)
    || text.match(/\b(?:Order|Purchase\s*Order)\s*(?:No|Number|#)?\s*[:.]?\s*([A-Za-z0-9\-_/]+)/i)
    || text.match(/\b(PO-[0-9]{3,5})\b/i)
  const po_number = normalizePo(poMatch ? poMatch[1] : null)

  // 5. Vendor name: the first real line at the top (sellers print their name first).
  let vendor_name: string | null = null
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const cleaned = lines[i].replace(/\b(?:tax\s*invoice|invoice|tax|original|duplicate|bill)\b/gi, '').trim()
    if (cleaned.length > 2 && !/^\d{3,}/.test(cleaned) && !/^(?:bill|ship|invoice|date)/i.test(cleaned)) { vendor_name = cleaned; break }
  }
  if (vendor_name && vendor_name === vendor_name.toUpperCase()) {
    vendor_name = vendor_name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }

  // 6. GSTINs. The seller's sits above "Bill to", the buyer's below. A rotated photo can split one in two tokens.
  const billToIdx = lines.findIndex((l) => /\b(?:BILL(?:ED)?\s*TO|BUYER|CONSIGNEE|SHIP\s*TO)\b/i.test(l))
  const gst: { line: number; value: string; valid: boolean }[] = []
  lines.forEach((l, i) => {
    const m = l.match(/\bGST\s*(?:IN|No\.?|Number)\b\s*[:.\-]?\s*(.+)$/i)
    if (!m) return
    const tokens = m[1].split(/\s+/)
    let cand = tokens[0] ?? ''
    if (cand.replace(/[^0-9A-Za-z]/g, '').length < 15 && tokens[1]) cand += tokens[1]
    const fixed = repairGstin(cand)
    const raw = normGstin(cand)?.slice(0, 15) ?? null
    if (fixed || raw) gst.push({ line: i, value: fixed ?? raw!, valid: Boolean(fixed) })
  })
  const vendorG = billToIdx >= 0 ? gst.find((g) => g.line < billToIdx) ?? null : gst[0] ?? null
  const buyerG = billToIdx >= 0 ? gst.find((g) => g.line > billToIdx) ?? null : gst[1] ?? null
  const vendor_gstin = vendorG?.value ?? null
  const buyer_gstin = buyerG?.value ?? null
  if (vendorG && !vendorG.valid) uncertain.push('vendor_gstin')
  if (buyerG && !buyerG.valid) uncertain.push('buyer_gstin')

  // 7. Buyer name: the line under "Bill to", without the right-hand column text.
  let buyer_name: string | null = null
  if (billToIdx !== -1 && lines[billToIdx + 1]) {
    let bLine = lines[billToIdx + 1].replace(/Place\s*of\s*supply.*$/i, '').replace(/\s*(?:Invoice\s*Date|Ship\s*To|P\.?O|Due\s*Date).*$/i, '').trim()
    const words = bLine.split(' ')
    if (words.length >= 2 && words.length % 2 === 0) { // side-by-side Bill to / Ship to columns repeat the name
      const half = words.length / 2
      if (words.slice(0, half).join(' ').toLowerCase() === words.slice(half).join(' ').toLowerCase()) bLine = words.slice(0, half).join(' ')
    }
    buyer_name = bLine || null
  }

  // 8. Currency: rupee markers win; one stray "$" in OCR noise must not turn an Indian invoice into USD.
  const currency = /₹|\bRs\b\.?|\bINR\b|Rupees/i.test(text) ? 'INR' : /\bUSD\b|\$/.test(text) ? 'USD'
    : /€|\bEUR\b/i.test(text) ? 'EUR' : /£|\bGBP\b/i.test(text) ? 'GBP' : 'INR'

  // 9. Amounts by label, reading the right-most number on the line.
  const lineWith = (re: RegExp) => lines.filter((l) => re.test(l))
  const subLine = lineWith(/\b(?:Taxable\s*value|Sub\s*-?\s*total|Suibitotal|Taxable\s*amount)\b/i)[0]
  const subtotal = subLine ? lastMoney(subLine) : null
  const totalLines = lineWith(/\b(?:TOTAL|Grand\s*Total|Net\s*Payable|Amount\s*Payable|Total\s*Payable|Invoice\s*Total|Amount\s*Due|Balance\s*Due)\b/i)
    .filter((l) => !/\b(?:sub\s*-?\s*total|taxable|total\s*tax|in\s*words|qty|quantity)\b/i.test(l))
  const amount = totalLines.length ? lastMoney(totalLines[totalLines.length - 1]) : null

  let tax_amount: number | null = null
  let taxDerived = false // worked out from total − subtotal: then it can't confirm that the total was read right
  const taxOf = (re: RegExp) => { const l = lines.find((x) => re.test(x)); return l ? lastMoney(l) : null }
  const cgst = taxOf(/\bCGST\b/i), sgst = taxOf(/\b(?:SGST|UTGST)\b/i), igst = taxOf(/\bIGST\b/i), cess = taxOf(/\bCess\b/i)
  const generalTaxLine = lines.find((l) => /\b(?:Sales\s*Tax|Total\s*Tax|Tax\s*Amount|GST|VAT|Tax)\b/i.test(l) && !/\b(?:CGST|SGST|IGST|GSTIN|Taxable|Invoice)\b/i.test(l))
  if (cgst !== null && sgst !== null) tax_amount = round2(cgst + sgst + (cess ?? 0))
  else if (igst !== null) tax_amount = round2(igst + (cess ?? 0))
  else if (generalTaxLine) {
    const parsed = lastMoney(generalTaxLine)
    // A one-digit OCR slip within 15 paise of total − subtotal is taken as that difference; anything bigger stays as read.
    tax_amount = parsed !== null && amount && subtotal && amount >= subtotal && Math.abs(amount - subtotal - parsed) <= 0.15 ? round2(amount - subtotal) : parsed
  } else if (amount && subtotal && amount >= subtotal) { tax_amount = round2(amount - subtotal); taxDerived = true }

  // 10. Bank account: digits after "A/c No" (OCR often reads it "Alc", "A/C", "Ac"), look-alikes repaired.
  let bank_account: string | null = null
  const bankMatch = text.match(/(?:A\s*[/\\l]?\s*[CcGg]\.?\s*(?:No|Number)|Account\s*(?:No|Number)|Acct\.?\s*No)\.?\s*[:.]?\s*([0-9OoIlSB][0-9OoIlSB ]{6,24}[0-9OoIlSB])/i)
  if (bankMatch) {
    const d = digitsOnly(bankMatch[1]).replace(/\s/g, '')
    bank_account = /^\d{8,18}$/.test(d) ? d : null
    if (!bank_account) uncertain.push('bank_account')
  }

  // 11. Line items between the table header and the totals.
  const line_items: LineItem[] = []
  const tableHeaderIdx = lines.findIndex((l) => /description/i.test(l))
  const tableEndIdx = lines.findIndex((l, i) => i > tableHeaderIdx && /subtotal|taxable\s*value|\btotal\b|suibitotal/i.test(l))
  if (tableHeaderIdx !== -1 && tableEndIdx > tableHeaderIdx) {
    const isQtyFirst = /(?:qty|qry|ary|quantity).*description/i.test(lines[tableHeaderIdx])
    for (let i = tableHeaderIdx + 1; i < tableEndIdx; i++) {
      const row = lines[i].trim()
      if (!row || /terms|payment|condition|payable/i.test(row)) continue
      if (isQtyFirst) { // "1 Front and rear brake cables 100.00 100.00"
        const a = row.match(/^(\d+)\s+(?:\|\s*)?(.+?)\s+([0-9,]+(?:\.\d+)?)\s+([0-9,]+(?:\.\d+)?)\s*\|?$/)
        if (a) {
          const q = money(a[1]); let p = money(a[3]); let amt = money(a[4]); const d = a[2].replace(/[|]/g, '').trim()
          if (q && p && d) {
            if (amt && round2(q * p) !== amt) { // a lost decimal point ("500" for "5.00") shows up as a 100× mismatch
              if (round2(q * (p / 100)) === amt) p = round2(p / 100)
              else if (round2(q * (p / 100)) === round2(amt / 100)) { p = round2(p / 100); amt = round2(amt / 100) }
            }
            line_items.push({ description: d, hsn: null, qty: q, unit_price: p, amount: amt || round2(q * p) })
            continue
          }
        }
      }
      const numTokens = [...row.matchAll(/([0-9,]+(?:\.\d+)?)/g)]
      if (numTokens.length >= 3) { // "1 20 L plastic bucket with lid 3924 1,000 203.39 2,03,390.00": read right to left
        const amt = money(numTokens[numTokens.length - 1][0]), rate = money(numTokens[numTokens.length - 2][0]), q = money(numTokens[numTokens.length - 3][0])
        const hsnIdx = numTokens.length - 4
        const hsn = hsnIdx >= 0 && /^\d{4,8}$/.test(numTokens[hsnIdx][0]) ? numTokens[hsnIdx][0] : null
        const cut = hsn ? numTokens[hsnIdx].index! : numTokens[numTokens.length - 3].index!
        const desc = row.slice(0, cut).replace(/[|]/g, '').trim().replace(/^\d+\s+/, '').trim()
        if (desc && q && rate) line_items.push({ description: desc, hsn, qty: q, unit_price: rate, amount: amt || round2(q * rate) })
      }
    }
  }

  // Confidence from what was found and whether it hangs together. Arithmetic that doesn't add up lowers it and
  // marks the totals "check this", but the values stay as printed.
  const linesSum = line_items.length ? round2(line_items.reduce((s, l) => s + l.amount, 0)) : subtotal
  const addsUp = !taxDerived && amount !== null && linesSum !== null && Math.abs(linesSum + (tax_amount ?? 0) - amount) <= Math.max(2, amount * 0.001)
  if (amount !== null && linesSum !== null && !addsUp) uncertain.push('amount', 'tax_amount')
  if (taxDerived) uncertain.push('tax_amount')
  if (!invoice_no) uncertain.push('invoice_no')
  if (!invoice_date) uncertain.push('invoice_date')
  if (amount === null) uncertain.push('amount')
  if (!po_number) uncertain.push('po_number')
  let conf = 0.35
  if (invoice_no) conf += 0.1
  if (invoice_date) conf += 0.1
  if (amount !== null) conf += 0.15
  if (buyer_name || buyer_gstin) conf += 0.05
  if (line_items.length) conf += 0.1
  if (addsUp) conf += 0.1
  if (po_number) conf += 0.05
  if (vendorG?.valid) conf += 0.05
  conf -= 0.05 * new Set(uncertain.filter((u) => u.endsWith('gstin') || u === 'bank_account')).size
  const confidence = Math.max(0.1, Math.min(0.95, round2(conf)))

  const fields = cleanFields({ invoice_no, invoice_date, due_date, vendor_name, vendor_gstin, buyer_name, buyer_gstin, po_number, currency,
    subtotal, tax_amount, amount, bank_account, line_items })
  return { fields, confidence, uncertain: [...new Set(uncertain)] }
}
