import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

process.loadEnvFile('./.env.local')
const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY

const client = () => createClient(URL, KEY, { auth: { persistSession: false } })

async function fn(c, name, body) {
  const { data, error } = await c.functions.invoke(name, { body })
  if (error) {
    const msg = await error.context?.json?.().then((b) => b.error).catch(() => null)
    throw new Error(`${name}: ${msg ?? error.message}`)
  }
  return data
}

async function run() {
  const PNG = readFileSync('./samples/S1-clean.png')
  const ts = Date.now()
  const password = 'ShowcasePassword123!'

  console.log('1. Signing up showcase seller, buyer, lender...')
  const seller = client()
  const sellerEmail = `seller-${ts}@apex.test`
  await seller.auth.signUp({ email: sellerEmail, password })
  const sParty = await fn(seller, 'onboard', {
    role: 'supplier', business_name: 'Apex Manufacturing Ltd', gstin: '33AAACQ9876F1Z5', bank_account: '918020014321', city: 'Coimbatore', full_name: 'Vikram Malhotra'
  })

  const buyer = client()
  const buyerEmail = `buyer-${ts}@metro.test`
  await buyer.auth.signUp({ email: buyerEmail, password })
  const bParty = await fn(buyer, 'onboard', {
    role: 'buyer', business_name: 'Metro Retail Stores', gstin: '33AACCP1234D1Z9', bank_account: '777705551201', city: 'Chennai', full_name: 'Pooja Sundaram'
  })

  const lender = client()
  const lenderEmail = `lender-${ts}@primefin.test`
  await lender.auth.signUp({ email: lenderEmail, password })
  const lParty = await fn(lender, 'onboard', {
    role: 'lender', business_name: 'PrimeFin Capital', full_name: 'Asha Menon'
  })

  console.log('2. Creating Purchase Orders & Deliveries...')
  const po1 = await fn(buyer, 'orders', {
    action: 'create_po', supplier_id: sParty.party_id, po_number: 'PO-9101',
    item: 'Industrial Polymer Drums 200L', qty: 400, unit_price: 500, tax_rate: 18
  })
  await fn(buyer, 'orders', { action: 'record_delivery', po_id: po1.id, qty_delivered: 400 })

  const po2 = await fn(buyer, 'orders', {
    action: 'create_po', supplier_id: sParty.party_id, po_number: 'PO-9102',
    item: 'Reinforced Pallet Crates', qty: 250, unit_price: 320, tax_rate: 18
  })
  await fn(buyer, 'orders', { action: 'record_delivery', po_id: po2.id, qty_delivered: 250 })

  console.log('3. Uploading and submitting Invoices...')
  // Invoice 1: Approved & Offer Released
  const path1 = `${sParty.party_id}/${randomUUID()}.png`
  await seller.storage.from('invoices').upload(path1, PNG, { contentType: 'image/png' })
  const ex1 = await fn(seller, 'extract-invoice', { path: path1 })
  const res1 = await fn(seller, 'run-checks', {
    invoice_id: ex1.invoice_id, buyer_id: bParty.party_id, fields: {
      invoice_no: 'APEX-9101', invoice_date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10),
      vendor_name: 'Apex Manufacturing Ltd', vendor_gstin: '33AAACQ9876F1Z5', buyer_name: 'Metro Retail Stores', buyer_gstin: '33AACCP1234D1Z9',
      po_number: 'PO-9101', currency: 'INR', subtotal: 200000, tax_amount: 36000, amount: 236000, bank_account: '918020014321',
      line_items: [{ description: 'Industrial Polymer Drums 200L', qty: 400, unit_price: 500, amount: 200000 }]
    }
  })
  console.log('Invoice 1 checks run:', res1.decision, res1.risk.breakdown.filter(x => x.status === 'fail' || x.status === 'warn'))
  if (res1.decision === 'review') {
    await fn(lender, 'invoice-action', { invoice_id: ex1.invoice_id, action: 'approve' })
    await fn(buyer, 'invoice-action', { invoice_id: ex1.invoice_id, action: 'confirm' })
    await fn(seller, 'invoice-action', { invoice_id: ex1.invoice_id, action: 'accept' })
  }

  // Invoice 2: Under Review in Lender Queue
  const path2 = `${sParty.party_id}/${randomUUID()}.png`
  await seller.storage.from('invoices').upload(path2, PNG, { contentType: 'image/png' })
  const ex2 = await fn(seller, 'extract-invoice', { path: path2 })
  await fn(seller, 'run-checks', {
    invoice_id: ex2.invoice_id, buyer_id: bParty.party_id, fields: {
      invoice_no: 'APEX-9102', invoice_date: new Date().toISOString().slice(0, 10), due_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
      vendor_name: 'Apex Manufacturing Ltd', vendor_gstin: '33AAACQ9876F1Z5', buyer_name: 'Metro Retail Stores', buyer_gstin: '33AACCP1234D1Z9',
      po_number: 'PO-9102', currency: 'INR', subtotal: 80000, tax_amount: 14400, amount: 94400, bank_account: '918020014321',
      line_items: [{ description: 'Reinforced Pallet Crates', qty: 250, unit_price: 320, amount: 80000 }]
    }
  })

  // Invoice 3: Freshly extracted draft ready for review
  const path3 = `${sParty.party_id}/${randomUUID()}.png`
  await seller.storage.from('invoices').upload(path3, PNG, { contentType: 'image/png' })
  const ex3 = await fn(seller, 'extract-invoice', { path: path3 })

  // Get full session tokens
  const sSess = (await seller.auth.getSession()).data.session
  const bSess = (await buyer.auth.getSession()).data.session
  const lSess = (await lender.auth.getSession()).data.session

  const showcaseInfo = {
    seller: { email: sellerEmail, password, session: sSess, party: sParty, invoice1: ex1.invoice_id, invoice2: ex2.invoice_id, invoiceDraft: ex3.invoice_id },
    buyer: { email: buyerEmail, password, session: bSess, party: bParty, po1: po1.id, po2: po2.id, invoiceToConfirm: ex2.invoice_id },
    lender: { email: lenderEmail, password, session: lSess, party: lParty, reviewInvoice: ex2.invoice_id, approvedInvoice: ex1.invoice_id }
  }
  writeFileSync('./tools/showcase_sessions.json', JSON.stringify(showcaseInfo, null, 2))
  console.log('Showcase setup complete! Saved to tools/showcase_sessions.json')
}

run().catch((e) => {
  console.error('Setup failed:', e)
  process.exit(1)
})
