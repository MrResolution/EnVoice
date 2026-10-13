import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { inr } from '@shared/normalize.ts'
import { short } from '@shared/canon.ts'
import { call, supabase } from '../../lib/supabase'
import { parties, toInvoice, type InvoiceRow, type Party } from '../../lib/data'
import { useDesktop } from '../../lib/layout'
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
const SOURCE = { gemini: 'Read by Gemini AI', cache: 'Cached AI result', reuse: 'Read before', manual: 'Type the fields' }

export function Review() {
  const { id } = useParams()
  const nav = useNavigate()
  const desktop = useDesktop()
  const locationState = useLocation().state as {
    note?: string
    fallbackFields?: Record<string, unknown>
    fallbackConfidence?: number
    fallbackBuyerId?: string
  } | null
  const note = locationState?.note
  const [inv, setInv] = useState<InvoiceRow | null>(null)
  const [form, setForm] = useState<Record<Key, string> | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [buyerId, setBuyerId] = useState('')
  const [buyers, setBuyers] = useState<Party[]>([])
  const [sheet, setSheet] = useState<'buyer' | 'doc' | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pos, setPos] = useState<any[]>([])

  useEffect(() => {
    supabase.from('invoices').select('*').eq('id', id!).maybeSingle().then(({ data }) => {
      if (!data) return setError('Invoice not found.')
      const row = toInvoice(data)
      if (row.status !== 'extracted') return nav(`/s/invoice/${row.id}`, { replace: true })
      const fallback = locationState?.fallbackFields
      const eff: Record<string, unknown> = { ...row }
      if (fallback) {
        for (const [k, v] of Object.entries(fallback)) {
          if (eff[k] === null || eff[k] === undefined || eff[k] === '' || (Array.isArray(eff[k]) && (eff[k] as unknown[]).length === 0)) {
            eff[k] = v
          }
        }
      }
      setInv(row); setBuyerId(row.buyer_id ?? locationState?.fallbackBuyerId ?? '')
      setForm(Object.fromEntries(FIELDS.map(([k]) => [k, str(eff[k as keyof InvoiceRow])])) as Record<Key, string>)
      const rawLines = (eff.line_items ?? []) as Array<{ description: string; hsn?: unknown; qty: unknown; unit_price: unknown; amount: unknown }>
      setLines(rawLines.map((l) => ({ description: l.description, hsn: str(l.hsn), qty: str(l.qty), unit_price: str(l.unit_price), amount: str(l.amount) })))
    })
    parties(true).then((m) => setBuyers([...m.values()].filter((p) => p.type === 'buyer')))
    supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setPos(data)
    })
  }, [id, nav])

  function matchPO(po: any) {
    setBuyerId(po.buyer_id)
    const matchingBuyer = buyers.find((b) => b.id === po.buyer_id)
    const subtotal = po.unit_price ? Math.round(po.qty * po.unit_price) : Math.round(po.total / 1.18)
    const tax_amount = Math.round(po.total - subtotal)
    const poNumDigits = (po.po_number || '').replace(/\D/g, '') || '1001'
    const today = new Date().toISOString().split('T')[0]
    const due = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]

    setForm((prev) => ({
      ...prev!,
      buyer_name: matchingBuyer?.name ?? 'Peacock Retail',
      po_number: po.po_number,
      invoice_no: prev?.invoice_no ? prev.invoice_no : `INV-${poNumDigits}`,
      invoice_date: prev?.invoice_date ? prev.invoice_date : today,
      due_date: prev?.due_date ? prev.due_date : due,
      subtotal: String(subtotal),
      tax_amount: String(tax_amount),
      amount: String(po.total),
      currency: 'INR',
    }))

    setLines([
      {
        description: po.item || 'Goods',
        hsn: String(po.hsn || '3924'),
        qty: String(po.qty || 100),
        unit_price: String(po.unit_price || 200),
        amount: String(subtotal),
      },
    ])
    buzz(15)
  }

  const hasFallback = Boolean(locationState?.fallbackFields)
  const isLocalOcr = (inv?.ai_source === 'manual' && Boolean(inv?.ai_fields)) || hasFallback
  const ai = (inv?.ai_fields ?? locationState?.fallbackFields) as Record<string, unknown> | null
  const edited = (k: Key) => Boolean(ai) && norm(ai![k]) !== norm(form?.[k]) && !(Number(ai![k]) === Number(norm(form?.[k])) && norm(form?.[k]) !== '')
  const buyer = buyers.find((b) => b.id === buyerId)
  const shownBuyers = useMemo(
    () =>
      buyers.filter(
        (b) =>
          b.name.toLowerCase().includes(query.toLowerCase()) ||
          (b.city && b.city.toLowerCase().includes(query.toLowerCase())) ||
          (b.upi_id && b.upi_id.toLowerCase().includes(query.toLowerCase())),
      ),
    [buyers, query],
  )

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

  if (!inv || !form) {
    return (
      <Page>
        <TopBar back={<RoundBtn icon="back" label="Back" to="/s" />} title="Check extracted fields" />
        <div className="space-y-3 px-[18px]">
          {error ? <ErrorNote>{error}</ErrorNote> : <><Skeleton className="h-32" /><Skeleton className="h-96" /></>}
        </div>
      </Page>
    )
  }

  const pct = inv.ai_confidence !== null ? Math.round(inv.ai_confidence * 100) : (locationState?.fallbackConfidence ? Math.round(locationState.fallbackConfidence * 100) : null)
  const sourceText = isLocalOcr ? 'Read by Local AI' : SOURCE[inv.ai_source]

  return (
    <Page className="space-y-5">
      <TopBar back={<RoundBtn icon="back" label="Back" to="/s" />} title="Verify invoice fields" subtitle={inv.ai_source === 'manual' && !isLocalOcr ? 'Enter document fields manually' : 'AI extracted fields automatically · Please confirm details before running checks'} />

      {note && <div role="status" className="rounded-2xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">{note}</div>}

      <form onSubmit={submit} className={desktop ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start' : 'space-y-3 px-[18px]'}>
        {/* LEFT COLUMN: Document Preview on Desktop */}
        {desktop && (
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <Card className="p-4 border border-line">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-ink">Original invoice</span>
                <span className="text-xs text-muted font-mono">SHA-256: {short(inv.file_hash)}</span>
              </div>
              <div className="max-h-[75vh] overflow-y-auto thin-scroll rounded-xl bg-ground/50 p-2 border border-line">
                <DocumentView path={inv.file_path} type={inv.file_type} />
              </div>
            </Card>
          </div>
        )}

        {/* RIGHT COLUMN: Extracted Fields & Controls */}
        <div className={desktop ? 'lg:col-span-7 space-y-4' : 'space-y-3'}>
          {/* Mobile Document Button */}
          {!desktop && (
            <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setSheet('doc')} className="relative flex w-full items-center gap-4 overflow-hidden rounded-[24px] bg-ink p-3.5 text-left text-white">
              <Rings className="-bottom-12 -right-10 h-32 w-32" />
              <DocThumb path={inv.file_path} type={inv.file_type} />
              <span className="relative flex-1">
                <Badge tone={!isLocalOcr && inv.ai_source === 'manual' ? 'warn' : (pct !== null && pct < 80) ? 'warn' : 'lime'}>
                  {sourceText}{pct !== null && (!isLocalOcr ? inv.ai_source !== 'manual' : true) ? ` · ${pct}% confidence` : ''}
                </Badge>
                <span className="mt-2 block text-[26px] font-bold">{form.amount ? inr(Number(norm(form.amount))) : '₹ —'}</span>
                <span className="block text-xs text-soft">total · fingerprint {short(inv.file_hash)} · tap to view</span>
              </span>
            </motion.button>
          )}

          {/* AI Banner for Desktop */}
          {desktop && (
            <div className="flex items-center justify-between rounded-2xl bg-ink p-4 text-white">
              <div>
                <Badge tone={!isLocalOcr && inv.ai_source === 'manual' ? 'warn' : (pct !== null && pct < 80) ? 'warn' : 'lime'}>
                  {sourceText} {pct !== null && (!isLocalOcr ? inv.ai_source !== 'manual' : true) ? `(${pct}% confidence)` : ''}
                </Badge>
                <div className="mt-1 text-xs text-soft">Review values below against the document on the left.</div>
              </div>
              <div className="text-right">
                <span className="block text-2xl font-extrabold text-lime">{form.amount ? inr(Number(norm(form.amount))) : '₹ —'}</span>
                <span className="block text-[11px] text-soft">Total invoice payable</span>
              </div>
            </div>
          )}

          {/* Quick Auto-Match from Open Purchase Orders */}
          {pos.length > 0 && (
            <Card className="p-4 border-2 border-lime/30 bg-lime/5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <Icon name="sparkle" size={14} />
                  Match with Purchase Order
                </span>
                <span className="text-[11px] text-muted font-medium">1-tap auto-fill</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {pos.map((p) => {
                  const active = form.po_number === p.po_number
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => matchPO(p)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                        active
                          ? 'bg-ink text-white ring-2 ring-lime'
                          : 'bg-white border border-line text-ink hover:border-ink'
                      }`}
                    >
                      <span>{p.po_number}</span>
                      <span className="text-[10px] opacity-70">({inr(p.total)})</span>
                      {active && <span className="text-lime">✓</span>}
                    </button>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Form Fields Card */}
          <Card className="px-5 py-2 border border-line">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {FIELDS.map(([k, label, kind]) => (
                <label key={k} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line py-2.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    {label}
                    {edited(k) && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-2 w-2 rounded-full bg-warn" aria-label="edited by user" />}
                  </span>
                  <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} type={kind === 'date' ? 'date' : 'text'} inputMode={kind === 'money' ? 'decimal' : undefined}
                    className="min-w-0 flex-1 bg-transparent text-right text-sm font-bold text-ink outline-none placeholder:text-soft" placeholder="—" />
                </label>
              ))}
            </div>
          </Card>

          {/* Line Items Card */}
          <Card className="p-5 border border-line">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-ink">Line items</span>
                <span className="ml-2 text-xs text-muted">({lines.length} items)</span>
              </div>
              <button type="button" onClick={() => setLines([...lines, { description: '', hsn: '', qty: '', unit_price: '', amount: '' }])} className="rounded-xl bg-ground px-3 py-1.5 text-xs font-bold text-ink hover:bg-line transition">
                + Add item
              </button>
            </div>
            {lines.length === 0 && <p className="text-xs text-muted">No line items detected. Click "+ Add item" to add from the invoice.</p>}
            {lines.map((l, i) => (
              <div key={i} className="mb-2.5 grid grid-cols-12 gap-2 rounded-2xl bg-ground p-3">
                <input aria-label="Description" placeholder="Item description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className="col-span-11 min-h-10 rounded-xl bg-white px-3 text-xs font-semibold outline-none" />
                <button type="button" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="col-span-1 flex min-h-10 items-center justify-center rounded-xl bg-white text-bad hover:bg-bad-soft transition"><Icon name="x" size={14} /></button>
                <input aria-label="Qty" placeholder="Qty" inputMode="decimal" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className="col-span-4 min-h-10 rounded-xl bg-white px-3 text-xs outline-none" />
                <input aria-label="Unit price" placeholder="Unit ₹" inputMode="decimal" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} className="col-span-4 min-h-10 rounded-xl bg-white px-3 text-xs outline-none" />
                <input aria-label="Total amount" placeholder="Amount ₹" inputMode="decimal" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} className="col-span-4 min-h-10 rounded-xl bg-white px-3 text-xs outline-none font-bold" />
              </div>
            ))}
          </Card>

          {/* Buyer Selector Card */}
          <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setSheet('buyer')} className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-white p-4 text-left shadow-sm hover:border-ink transition">
            {buyer ? <Avatar name={buyer.name} dark /> : <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warn-soft text-warn"><Icon name="building" /></span>}
            <span className="flex-1 min-w-0">
              <span className="block text-xs text-muted">{buyer ? (inv.buyer_id === buyerId ? 'Matched buyer · verified' : 'Selected buyer') : 'Required'}</span>
              <span className="block text-sm font-bold text-ink truncate">{buyer ? `${buyer.name} (${buyer.upi_id})` : 'Choose buyer from directory →'}</span>
            </span>
            <span className="rounded-xl bg-ground px-3 py-1.5 text-xs font-bold text-ink">Change</span>
          </motion.button>

          <p className="px-1 text-xs leading-relaxed text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-warn mr-1.5" /> An orange indicator marks a field you modified. Discrepancies in total amount or bank account are flagged for lender review.
          </p>

          {error && <ErrorNote>{error}</ErrorNote>}

          <Btn type="submit" busy={busy} icon="next" className="w-full">
            Submit invoice for 21 automated checks
          </Btn>
        </div>
      </form>

      {/* Buyer Search Modal / Sheet */}
      <Sheet open={sheet === 'buyer'} onClose={() => setSheet(null)} title="Select invoice buyer">
        <label className="mb-3 flex h-11 items-center gap-2 rounded-full bg-ground px-4">
          <Icon name="search" size={16} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, city, or UPI ID (e.g. peacock@invopay)" className="flex-1 bg-transparent text-sm outline-none" />
        </label>
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto thin-scroll">
          {shownBuyers.map((b) => (
            <li key={b.id}>
              <button onClick={() => { setBuyerId(b.id); setSheet(null); setError(null) }} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${b.id === buyerId ? 'bg-ink text-white' : 'hover:bg-ground'}`}>
                <Avatar name={b.name} dark={b.id === buyerId} />
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm truncate">{b.name}</span>
                  <span className={`block text-xs ${b.id === buyerId ? 'text-lime font-mono' : 'text-muted'}`}>{b.upi_id} {b.city ? `· ${b.city}` : ''}</span>
                </span>
                {b.id === buyerId && <Icon name="check" size={16} stroke="var(--color-lime)" />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {/* Mobile-only Document Sheet */}
      {!desktop && (
        <Sheet open={sheet === 'doc'} onClose={() => setSheet(null)} title="Your document">
          <div className="max-h-[70vh] overflow-y-auto thin-scroll"><DocumentView path={inv.file_path} type={inv.file_type} /></div>
        </Sheet>
      )}
    </Page>
  )
}
