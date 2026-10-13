// Shared shapes for the engine. Type-only: used by edge functions (Deno), tests (Node) and the app (Vite).

export type Status = 'pass' | 'warn' | 'fail'
export type Category = 'three_way' | 'duplicates' | 'vendor_bank' | 'integrity' | 'behaviour'
/** Who read the fields: the server (gemini, cache, reuse), the seller's device (ocr) or the seller's hands (manual). */
export type AiSource = 'gemini' | 'cache' | 'reuse' | 'ocr' | 'manual'

export type LineItem = { description: string; hsn?: string | null; qty: number; unit_price: number; amount: number }

/** What we read off an invoice (AI, cache or typed by hand), after normalisation. */
export type InvoiceFields = {
  invoice_no: string | null
  invoice_date: string | null // YYYY-MM-DD
  due_date: string | null
  vendor_name: string | null
  vendor_gstin: string | null
  buyer_name: string | null
  buyer_gstin: string | null
  po_number: string | null
  currency: string | null
  subtotal: number | null
  tax_amount: number | null
  amount: number | null // final total payable
  bank_account: string | null
  line_items: LineItem[]
}

export type Invoice = InvoiceFields & {
  id: string
  supplier_id: string
  buyer_id: string | null
  status: string
  file_hash: string
  image_hash: string | null
  ai_source: AiSource
  ai_confidence: number | null
  ai_fields: Partial<InvoiceFields> | null
  edited_fields: string[]
  created_at?: string
}

export type Party = {
  id: string
  type: 'supplier' | 'buyer'
  name: string
  gstin: string | null
  bank_account: string | null // the approved account
  phone: string | null
  email: string | null
  address: string | null
  credit_limit: number
  on_time_rate: number | null // null = no payment history yet
  avg_delay_days: number
  outstanding: number
  avg_invoice_amount: number | null
}

export type PurchaseOrder = {
  id: string
  po_number: string
  buyer_id: string
  supplier_id: string
  item: string
  hsn?: string | null
  qty: number
  unit_price: number
  tax_rate: number
  total: number
  po_date: string
}

export type DeliveryReceipt = {
  id: string
  po_id: string
  grn_number: string
  qty_delivered: number
  delivered_on: string
  confirmed_by_buyer: boolean
}

/** Everything a check may look at. run-checks loads it once so every check stays a pure function. */
export type Ctx = {
  invoice: Invoice
  supplier: Party
  buyer: Party | null
  po: PurchaseOrder | null
  receipt: DeliveryReceipt | null
  others: Invoice[] // every other invoice, any status
}

/** Values shown in the three-way match matrix (one column per document). */
export type MatchValues = { invoice?: string; po?: string; receipt?: string }

export type CheckResult = { name: string; category: Category; status: Status; reason: string; values?: MatchValues }

/** A check is one function. null = not applicable (e.g. no PO to compare with). */
export type Check = (ctx: Ctx) => CheckResult | null
