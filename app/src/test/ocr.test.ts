import { describe, expect, it } from 'vitest'
import { parseInvoiceText } from '../lib/ocr/parser.ts'
import { matchBuyer } from '@shared/fields.ts'
import world from '../../../samples/world.json' with { type: 'json' }

const buyers = world.parties.filter((p) => p.type === 'buyer')

// Realistic OCR text dumps captured from Tesseract on the sample invoices
const S1_OCR = `RAVI PLASTICS TAX INVOICE
14 SIDCO Industrial Estate, Kurichi, Coimbatore 641021 Invoice No: INV-1001
GSTIN: 33ABCPR4821K1Z6 Invoice Date: 10-Oct-2026
Phone: +91 98400 11111 - accounts@raviplastics.example Due Date: 09-Dec-2026
PO No: PO-4501
BILL TO
Peacock Retail Pvt Ltd Place of supply: Tamil Nadu (33)
200 Anna Salai, Chennai 600002
GSTIN: 33AACCP5120D1Z29
# Description of goods HSN Qty Rate (Rs.) Amount (Rs.)
1 20 L plastic bucket with lid 3924 1,000 203.39  2,03,390.00
Taxable value 2,03,390.00
CGST @ 9% 18,305.10
SGST @ 9% 18,305.10
Round off -0.20
TOTAL Rs. 2,40,000.00
Amount in words: Rupees Two Lakh Forty Thousand Only
BANK DETAILS
Mock Bank Ltd - A/c No: 918020014321 - IFSC: MOCK0001432
For Ravi Plastics
Authorised signatory`

const S3_OCR = `RAVI PLASTICS TAX INVOICE
14 SIDCO Industrial Estate, Kurichi, Coimbatore 641021 Invoice No: INV-1002
GSTIN: 33ABCPR4821K1Z6 Invoice Date: 11-Oct-2026
Phone: +91 98400 11111 - accounts@raviplastics.example Due Date: 25-Nov-2026
PO No: PO-4502
BILL TO
Banyan Stores Place of supply: Tamil Nadu (33)
45 Avinashi Road, Coimbatore 641018
GSTIN: 33AADCB8834E1Z3
# Description of goods HSN Qty Rate (Rs.) Amount (Rs.)
1 50 L storage drum 3923 100 500.00 50,000.00
Taxable value 50,000.00
CGST @ 9% 4,500.00
SGST @ 9% 4,500.00
TOTAL Rs. 59,000.00
BANK DETAILS
Mock Bank Ltd - A/c No: 918020014321 - IFSC: MOCK0001432`

const S4_OCR = `KAVERI TRADERS TAX INVOICE
8 Big Bazaar Street, Tiruchirappalli 620008 Invoice No: KT-0042
GSTIN: 33AAKFK7731M1Z2 Invoice Date: 09-Oct-2026
Phone: +91 94430 22222 - kaveritraders@gmail.com Due Date: 23-Nov-2026
PO No: PO-4503
BILL TO
Kaveri Retail Place of supply: Tamil Nadu (33)
22 West Boulevard Road, Tiruchirappalli 620002
GSTIN: 33AAKCK2290Q1Z7
# Description of goods HSN Qty Rate (Rs.) Amount (Rs.)
1 Steel storage rack, 5 shelf 9403 60 1,000.00 60,000.00
Taxable value 60,000.00
CGST @ 9% 5,400.00
SGST @ 9% 5,400.00
TOTAL Rs. 70,800.00
BANK DETAILS
Mock Bank Ltd - A/c No: 602010057788 - IFSC: MOCK0005778`

const S5_OCR = `RAVI PLASTICS TAX INVOICE
14 SIDCO Industrial Estate, Kurichi, Coimbatore 641021 Invoice No: INV-0998
GSTIN: 33ABCPR4821K1Z6 Invoice Date: 02-Oct-2026
Phone: +91 98400 11111 - accounts@raviplastics.example Due Date: 16-Nov-2026
PO No: PO-4504
BILL TO
Banyan Stores Place of supply: Tamil Nadu (33)
45 Avinashi Road, Coimbatore 641018
GSTIN: 33AADCB8834E1Z3
# Description of goods HSN Qty Rate (Rs.) Amount (Rs.)
1 12 L pedal dustbin 3924 300 250.00 75,000.00
Taxable value 75,000.00
CGST @ 9% 6,750.00
SGST @ 9% 6,750.00
TOTAL Rs. 88,500.00
BANK DETAILS
Mock Bank Ltd - A/c No: 918020014321 - IFSC: MOCK0001432`

const S6_OCR = `RAVI PLASTICS TAX INVOICE
14 SIDCO Industrial Estate, Kurichi, Coimbatore 641021 Invoice No: INV-1007
GSTIN: 33ABCPR4821K1Z6 Invoice Date: 10-Oct-2026
Phone: +91 98400 11111 - accounts@raviplastics.example Due Date: 09-Dec-2026
PO No: PO-4501
BILL TO
Peacock Retail Pvt Ltd Place of supply: Tamil Nadu (33)
200 Anna Salai, Chennai 600002
GSTIN: 33AACCP5120D1Z9
# Description of goods HSN Qty Rate (Rs.) Amount (Rs.)
1 20 L plastic bucket with lid 3924 1,000 203.39  2,03,390.00
Taxable value 2,03,390.00
CGST @ 9% 18,305.10
SGST @ 9% 18,305.10
TOTAL Rs. 2,46,000.00
BANK DETAILS
Mock Bank Ltd - A/c No: 918020019911 - IFSC: MOCK0001432`

describe('Local OCR Parser Model', () => {
  it('extracts S1-clean correctly and matches buyer', () => {
    const { fields, confidence } = parseInvoiceText(S1_OCR)
    expect(fields).toMatchObject({
      invoice_no: 'INV-1001',
      invoice_date: '2026-10-10',
      due_date: '2026-12-09',
      vendor_name: 'Ravi Plastics',
      vendor_gstin: '33ABCPR4821K1Z6',
      buyer_name: 'Peacock Retail Pvt Ltd',
      po_number: 'PO-4501',
      currency: 'INR',
      subtotal: 203390,
      tax_amount: 36610.2,
      amount: 240000,
      bank_account: '918020014321',
    })
    expect(fields.line_items).toHaveLength(1)
    expect(fields.line_items[0]).toEqual({
      description: '20 L plastic bucket with lid',
      hsn: '3924',
      qty: 1000,
      unit_price: 203.39,
      amount: 203390,
    })
    expect(confidence).toBeGreaterThanOrEqual(0.85)

    const buyerId = matchBuyer(fields, buyers)
    expect(buyerId).toBe(buyers.find((b) => b.key === 'peacock')!.id)
  })

  it('extracts S3-mismatch correctly', () => {
    const { fields } = parseInvoiceText(S3_OCR)
    expect(fields).toMatchObject({
      invoice_no: 'INV-1002',
      invoice_date: '2026-10-11',
      due_date: '2026-11-25',
      vendor_name: 'Ravi Plastics',
      vendor_gstin: '33ABCPR4821K1Z6',
      buyer_name: 'Banyan Stores',
      buyer_gstin: '33AADCB8834E1Z3',
      po_number: 'PO-4502',
      amount: 59000,
      subtotal: 50000,
      tax_amount: 9000,
    })
    expect(fields.line_items[0].qty).toBe(100)
    expect(fields.line_items[0].unit_price).toBe(500)
    expect(matchBuyer(fields, buyers)).toBe(buyers.find((b) => b.key === 'banyan')!.id)
  })

  it('extracts S4-self-dealing correctly', () => {
    const { fields } = parseInvoiceText(S4_OCR)
    expect(fields).toMatchObject({
      invoice_no: 'KT-0042',
      invoice_date: '2026-10-09',
      due_date: '2026-11-23',
      vendor_name: 'Kaveri Traders',
      vendor_gstin: '33AAKFK7731M1Z2',
      buyer_name: 'Kaveri Retail',
      buyer_gstin: '33AAKCK2290Q1Z7',
      bank_account: '602010057788',
      amount: 70800,
    })
    expect(matchBuyer(fields, buyers)).toBe(buyers.find((b) => b.key === 'kaveri_retail')!.id)
  })

  it('extracts S5-tamper-target correctly', () => {
    const { fields } = parseInvoiceText(S5_OCR)
    expect(fields).toMatchObject({
      invoice_no: 'INV-0998',
      invoice_date: '2026-10-02',
      due_date: '2026-11-16',
      amount: 88500,
      subtotal: 75000,
      tax_amount: 13500,
    })
  })

  it('extracts S6-edited-copy correctly with modified bank and amount', () => {
    const { fields } = parseInvoiceText(S6_OCR)
    expect(fields).toMatchObject({
      invoice_no: 'INV-1007',
      amount: 246000,
      bank_account: '918020019911',
    })
  })

  it('extracts East Repair Inc. invoice correctly with line items, tax, and total', () => {
    const EAST_REPAIR_OCR = `East Repair Inc. INVOICE
1912 Harvest Lane
New York, NY 12210
Bill To Ship To Invoice # US-001
John Smith John Smith Invoice Date 11/02/2019
2 Court Square 3787 Pineview Drive
New York, NY 12210 Cambridge, MA 12210 Pos 2312/2019
Due Date 26/02/2019
QTY DESCRIPTION UNIT PRICE AMOUNT
1 Front and rear brake cables 100.00 100.00
2 New set of pedal arms 15.00 30.00
3 Labor 3hrs 5.00 15.00
Subtotal 145.00
Sales Tax 6.25% 9.06
TOTAL $154.06
Terms & Conditions
Payment is due within 15 days
Please make checks payable 10: East Repair Inc.`

    const { fields, confidence } = parseInvoiceText(EAST_REPAIR_OCR)
    expect(fields).toMatchObject({
      vendor_name: 'East Repair Inc.',
      invoice_no: 'US-001',
      invoice_date: '2019-02-11',
      due_date: '2019-02-26',
      buyer_name: 'John Smith',
      currency: 'USD',
      subtotal: 145,
      tax_amount: 9.06,
      amount: 154.06,
    })
    expect(fields.line_items).toHaveLength(3)
    expect(fields.line_items[0]).toEqual({
      description: 'Front and rear brake cables',
      hsn: null,
      qty: 1,
      unit_price: 100,
      amount: 100,
    })
    expect(fields.line_items[1]).toEqual({
      description: 'New set of pedal arms',
      hsn: null,
      qty: 2,
      unit_price: 15,
      amount: 30,
    })
    expect(fields.line_items[2]).toEqual({
      description: 'Labor 3hrs',
      hsn: null,
      qty: 3,
      unit_price: 5,
      amount: 15,
    })
    expect(confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('extracts East Repair Inc. from raw Tesseract output with realistic character noise', () => {
    const RAW_NOISY_OCR = `East Repair Inc. INVOICE
1912 Harvest Lane
New York, NY 12210
Bill To Ship To Invoice # us-co1
John Smith John Smith Invoice Date 1102/2019
2 Court Square 3787 Pineview Drive .
New York, NY 12210 Cambridge, MA 12210 Pos 231212019
Due Date 26/02/2019
QTY DESCRIPTION UNIT PRICE AMOUNT
1 Frees and rear brake cables 100.00 100.00
2 Neww set of pedal arms 15.00 30.00
3 Lator 3hrs 5.00 15.00
Subtotal 145.00
Sales Tax 6.25% 9.08
TOTAL $154.06
Terms & Conditions
Payment is due within 15 days
Please make checks payable 10: East Repair Inc.`

    const { fields, confidence } = parseInvoiceText(RAW_NOISY_OCR)
    expect(fields).toMatchObject({
      vendor_name: 'East Repair Inc.',
      invoice_no: 'US-001',
      invoice_date: '2019-02-11',
      due_date: '2019-02-26',
      buyer_name: 'John Smith',
      currency: 'USD',
      subtotal: 145,
      tax_amount: 9.06,
      amount: 154.06,
    })
    expect(fields.line_items).toHaveLength(3)
    expect(fields.line_items[0].qty).toBe(1)
    expect(fields.line_items[0].unit_price).toBe(100)
    expect(fields.line_items[1].qty).toBe(2)
    expect(fields.line_items[1].unit_price).toBe(15)
    expect(fields.line_items[2].qty).toBe(3)
    expect(fields.line_items[2].unit_price).toBe(5)
    expect(confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('normalizes various OCR lookalikes for invoice numbers', () => {
    expect(parseInvoiceText('Invoice # Us-Cot\nTOTAL $100').fields.invoice_no).toBe('US-001')
    expect(parseInvoiceText('Invoice # US-00t\nTOTAL $100').fields.invoice_no).toBe('US-001')
    expect(parseInvoiceText('Invoice # Us-0o1\nTOTAL $100').fields.invoice_no).toBe('US-001')
    expect(parseInvoiceText('Invoice # us-co1\nTOTAL $100').fields.invoice_no).toBe('US-001')
  })

  it('handles empty or corrupt text gracefully without throwing', () => {
    const { fields, confidence } = parseInvoiceText('Random noise text without invoice data')
    expect(fields.invoice_no).toBeNull()
    expect(fields.amount).toBeNull()
    expect(fields.line_items).toEqual([])
    expect(confidence).toBeLessThan(0.8)
  })
})
