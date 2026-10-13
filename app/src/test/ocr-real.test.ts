// @vitest-environment node
// Accuracy benchmark for the on-device reader: REAL Tesseract OCR on every sample image, then the parser,
// scored field by field against the known values. Slow (~3 s per image), so it only runs on request:
//   OCR_BENCH=1 npx vitest run src/test/ocr-real.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createWorker } from 'tesseract.js'
import { parseInvoiceText } from '../lib/ocr/parser.ts'
import world from '../../../samples/world.json' with { type: 'json' }
import datasets from '../../../samples/DATASETS.json' with { type: 'json' }

const ROOT = new URL('../../../', import.meta.url).pathname
type Expect = Record<string, string | number | null>

const fromWorld = (key: string): Expect => {
  const s = world.samples.find((x) => x.key === key)!
  const f = (s.fields ?? world.samples.find((x) => x.key === (s as { copy_of?: string }).copy_of)!.fields)!
  const l = f.line_items[0]
  return { invoice_no: f.invoice_no, invoice_date: f.invoice_date, due_date: f.due_date, po_number: f.po_number, vendor_gstin: f.vendor_gstin,
    buyer_gstin: f.buyer_gstin, subtotal: f.subtotal, tax_amount: f.tax_amount, amount: f.amount, bank_account: f.bank_account, qty: l.qty, unit_price: l.unit_price }
}
const CASES: [string, Expect][] = [
  ['S1-clean.png', fromWorld('S1')], ['S3-mismatch.png', fromWorld('S3')], ['S4-self-dealing.png', fromWorld('S4')],
  ['S5-tamper-target.png', fromWorld('S5')], ['S6-edited-copy.png', fromWorld('S6')],
  ...datasets.map((d): [string, Expect] => [d.invoice.files.png.replace('samples/', ''), {
    invoice_no: d.invoice.invoice_no, invoice_date: d.invoice.invoice_date, due_date: d.invoice.due_date, po_number: d.purchase_order.po_number,
    vendor_gstin: d.seller.gstin, buyer_gstin: d.buyer.gstin, subtotal: d.invoice.subtotal, tax_amount: d.invoice.tax_amount, amount: d.invoice.amount,
    bank_account: d.seller.bank_account, qty: d.purchase_order.qty, unit_price: d.purchase_order.unit_price,
  }]),
]

// Phone-photo look-alikes (rotation, blur, JPEG 30, half resolution, skew + shadow + noise): tools in the test folder.
const PHOTOS = ['rot', 'blur', 'jpeg30', 'half', 'halfpre', 'photo'].flatMap((kind) =>
  ['S1-clean', 'INV-5104', 'S4-self-dealing', 'INV-8801'].map((name): [string, Expect] => [`../app/src/test/fixtures/photos/${name}__${kind}.${kind === 'halfpre' ? 'png' : 'jpg'}`, CASES.find((c) => c[0].startsWith(name))![1]]))
const SET = process.env.OCR_BENCH === 'photos' ? PHOTOS : process.env.OCR_BENCH === 'all' ? [...CASES, ...PHOTOS] : CASES

describe.skipIf(!process.env.OCR_BENCH)('on-device reader on real OCR output', () => {
  it('reads every sample invoice', async () => {
    const worker = await createWorker('eng', 1, { langPath: ROOT + 'app/public/tesseract', gzip: true })
    let right = 0, total = 0
    const misses: string[] = []
    for (const [file, want] of SET) {
      const t = Date.now()
      const { data } = await worker.recognize(readFileSync(ROOT + 'samples/' + file))
      const { fields, confidence } = parseInvoiceText(data.text)
      const got: Expect = { ...fields, qty: fields.line_items[0]?.qty ?? null, unit_price: fields.line_items[0]?.unit_price ?? null } as unknown as Expect
      const wrong = Object.keys(want).filter((k) => String(got[k] ?? '') !== String(want[k] ?? ''))
      right += Object.keys(want).length - wrong.length; total += Object.keys(want).length
      console.log(`${file.replace(/.*\//, '').padEnd(28)} ${String(Date.now() - t).padStart(5)} ms  conf ${confidence}  ${wrong.length ? 'WRONG: ' + wrong.map((k) => `${k}=${JSON.stringify(got[k])} (want ${JSON.stringify(want[k])})`).join(', ') : 'all fields right'}`)
      if (wrong.length) misses.push(file)
      if (process.env.OCR_DUMP === file) console.log(data.text)
    }
    await worker.terminate()
    console.log(`\nfield accuracy: ${right}/${total} = ${((right / total) * 100).toFixed(1)}%`)
    expect(right / total).toBeGreaterThan(0.5)
  }, 300_000)
})
