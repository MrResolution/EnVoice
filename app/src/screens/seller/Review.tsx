import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { inr } from '@shared/normalize.ts'
import { short } from '@shared/canon.ts'
import { call, supabase } from '../../lib/supabase'
import { parties, toInvoice, type InvoiceRow, type Party } from '../../lib/data'
import { DocThumb, DocumentView } from '../../components/DocumentView'
import { Icon, Rings } from '../../ui/Icon'
import { Avatar, Badge, Btn, Card, ErrorNote, RoundBtn, Skeleton } from '../../ui/kit'
import { buzz, Page, Sheet } from '../../ui/motion'
import { TopBar } from '../../ui/MobileShell'

type Line = { description: string; hsn: string; qty: string; unit_price: string; amount: string }
const FIELDS = [
  ['invoice_no', 'Invoice number', 'text'], ['invoice_date', 'Invoice date', 'date'], ['due_date', 'Due date', 'date'],
  ['po_number', 'PO number', 'text'], ['vendor_name', 'Vendor name', 'text'], ['vendor_gstin', 'Vendor GSTIN', 'text'],
  ['buyer_name', 'Buyer (as printed)', 'text'], ['subtotal', 'Subtotal', 'money'], ['tax_amount', 'GST', 'money'],
  ['amount', 'Total payable', 'money'], ['bank_account', 'Pay into account', 'text'], ['currency', 'Currency', 'text'],
] as const
type Key = (typeof FIELDS)[number][0]
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const norm = (v: unknown) => str(v).replace(/[,\s₹]/g, '').toLowerCase()
const SOURCE = { gemini: 'Read by Gemini', cache: 'Cached AI result', reuse: 'Read before', manual: 'Type the fields' }

export function Review() {
  const { id } = useParams()
  const nav = useNavigate()
  const note = (useLocation().state as { note?: string } | null)?.note
  const [inv, setInv] = useState<InvoiceRow | null>(null)
  const [form, setForm] = useState<Record<Key, string> | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [buyerId, setBuyerId] = useState('')
  const [buyers, setBuyers] = useState<Party[]>([])
  const [sheet, setSheet] = useState<'buyer' | 'doc' | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('invoices').select('*').eq('id', id!).maybeSingle().then(({ data }) => {
      if (!data) return setError('Invoice not found.')
      const row = toInvoice(data)
      if (row.status !== 'extracted') return nav(`/s/invoice/${row.id}`, { replace: true })
      setInv(row); setBuyerId(row.buyer_id ?? '')
      setForm(Object.fromEntries(FIELDS.map(([k]) => [k, str(row[k as keyof InvoiceRow])])) as Record<Key, string>)
      setLines((row.line_items ?? []).map((l) => ({ description: l.description, hsn: str(l.hsn), qty: str(l.qty), unit_price: str(l.unit_price), amount: str(l.amount) })))
    })
    parties(true).then((m) => setBuyers([...m.values()].filter((p) => p.type === 'buyer')))
  }, [id, nav])

  const ai = inv?.ai_fields as Record<string, unknown> | null
  const edited = (k: Key) => Boolean(ai) && inv?.ai_source !== 'manual' && norm(ai![k]) !== norm(form?.[k]) && !(Number(ai![k]) === Number(norm(form?.[k])) && norm(form?.[k]) !== '')
  const buyer = buyers.find((b) => b.id === buyerId)
  const shownBuyers = useMemo(() => buyers.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())), [buyers, query])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!buyerId) { setSheet('buyer'); return setError('Choose the buyer this invoice is raised on.') }
    setBusy(true); setError(null)
    try {
      await call('run-checks', { invoice_id: id, buyer_id: buyerId, fields: { ...form, line_items: lines } })
      buzz(20)
      nav(`/s/invoice/${id}`, { replace: true, state: { fresh: true } })
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  if (!inv || !form) return <Page><TopBar back={<RoundBtn icon="back" label="Back" to="/s" />} title="Check the fields" /><div className="space-y-3 px-[18px]">{error ? <ErrorNote>{error}</ErrorNote> : <><Skeleton className="h-32" /><Skeleton className="h-96" /></>}</div></Page>
  const pct = inv.ai_confidence !== null ? Math.round(inv.ai_confidence * 100) : null

  return (
    <Page>
      <TopBar back={<RoundBtn icon="back" label="Back" to="/s" />} title="Check the fields" subtitle={inv.ai_source === 'manual' ? 'type what the document says' : 'AI read, you confirm'} />
      <form onSubmit={submit} className="space-y-3 px-[18px]">
        {note && <div role="status" className="rounded-2xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">{note}</div>}
        <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setSheet('doc')} className="relative flex w-full items-center gap-4 overflow-hidden rounded-[24px] bg-ink p-3.5 text-left text-white">
          <Rings className="-bottom-12 -right-10 h-32 w-32" />
          <DocThumb path={inv.file_path} type={inv.file_type} />
          <span className="relative flex-1">
            <Badge tone={inv.ai_source === 'manual' || (pct !== null && pct < 80) ? 'warn' : 'lime'}>{SOURCE[inv.ai_source]}{pct !== null && inv.ai_source !== 'manual' ? ` · ${pct}% sure` : ''}</Badge>
            <span className="mt-2 block text-[26px] font-bold">{form.amount ? inr(Number(norm(form.amount))) : '₹ —'}</span>
            <span className="block text-xs text-soft">total · fingerprint {short(inv.file_hash)} · tap to view</span>
          </span>
        </motion.button>

        <Card className="px-4 py-1">
          {FIELDS.map(([k, label, kind]) => (
            <label key={k} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line py-2 last:border-0">
              <span className="flex items-center gap-1.5 text-sm text-muted">{label}{edited(k) && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-warn" aria-label="edited" />}</span>
              <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} type={kind === 'date' ? 'date' : 'text'} inputMode={kind === 'money' ? 'decimal' : undefined}
                className="min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold outline-none placeholder:text-soft" placeholder="—" />
            </label>
          ))}
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between"><span className="text-[15px] font-bold">Items</span><button type="button" onClick={() => setLines([...lines, { description: '', hsn: '', qty: '', unit_price: '', amount: '' }])} className="min-h-11 rounded-xl px-2 text-sm font-semibold">+ Add line</button></div>
          {lines.length === 0 && <p className="text-sm text-muted">No lines read. Add the items from the invoice.</p>}
          {lines.map((l, i) => (
            <div key={i} className="mb-2 grid grid-cols-6 gap-2 rounded-2xl bg-ground p-2.5">
              <input aria-label="Description" placeholder="Item" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className="col-span-5 min-h-11 rounded-xl bg-white px-3 text-sm font-semibold outline-none" />
              <button type="button" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="flex min-h-11 items-center justify-center rounded-xl bg-white text-bad"><Icon name="x" size={16} /></button>
              {(['qty', 'unit_price', 'amount'] as const).map((f) => (
                <input key={f} aria-label={f} placeholder={f === 'qty' ? 'Qty' : f === 'unit_price' ? 'Unit ₹' : 'Amount ₹'} inputMode="decimal" value={l[f]}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)))} className="col-span-2 min-h-11 min-w-0 rounded-xl bg-white px-3 text-sm outline-none" />
              ))}
            </div>
          ))}
        </Card>

        <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setSheet('buyer')} className="flex w-full items-center gap-3 rounded-[22px] bg-white p-3.5 text-left">
          {buyer ? <Avatar name={buyer.name} dark /> : <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-warn-soft text-warn"><Icon name="building" /></span>}
          <span className="flex-1"><span className="block text-xs text-muted">{buyer ? (inv.buyer_id === buyerId ? 'Buyer · matched from the invoice' : 'Buyer') : 'Choose the buyer'}</span><span className="block text-[15px] font-bold">{buyer?.name ?? 'Who pays this invoice?'}</span></span>
          <span className="text-[13px] font-semibold text-muted">Change</span>
        </motion.button>

        <p className="px-1 text-xs leading-relaxed text-muted">An orange dot marks a field you changed. Changes to the number, amounts or bank account are shown to the lender.</p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Btn type="submit" busy={busy} icon="next" className="w-full">Submit for 21 checks</Btn>
      </form>

      <Sheet open={sheet === 'buyer'} onClose={() => setSheet(null)} title="Who is the buyer?">
        <label className="mb-3 flex h-12 items-center gap-2 rounded-full bg-ground px-4"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search buyers" className="flex-1 bg-transparent outline-none" /></label>
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto thin-scroll">
          {shownBuyers.map((b) => (
            <li key={b.id}><button onClick={() => { setBuyerId(b.id); setSheet(null); setError(null) }} className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left ${b.id === buyerId ? 'bg-ground' : ''}`}>
              <Avatar name={b.name} dark={b.id === buyerId} /><span className="flex-1"><span className="block font-semibold">{b.name}</span>{b.city && <span className="block text-xs text-muted">{b.city}</span>}</span>
              {b.id === buyerId && <Icon name="check" />}
            </button></li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={sheet === 'doc'} onClose={() => setSheet(null)} title="Your document">
        <div className="max-h-[70vh] overflow-y-auto thin-scroll"><DocumentView path={inv.file_path} type={inv.file_type} /></div>
      </Sheet>
    </Page>
  )
}
