import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { day, inr, qty as fmtQty, round2 } from '@shared/normalize.ts'
import { call } from '../../lib/supabase'
import { parties, useParties, usePOs, type Party, type PoRow } from '../../lib/data'
import { useDesktop } from '../../lib/layout'
import { Icon, Rings } from '../../ui/Icon'
import { Avatar, Badge, Btn, Card, Empty, ErrorNote, RoundBtn, Skeleton } from '../../ui/kit'
import { buzz, Page, Sheet, spring, Stagger, StaggerItem, useToast } from '../../ui/motion'
import { TopBar } from '../../ui/MobileShell'

export function Orders() {
  const { rows } = usePOs()
  const names = useParties()
  const desktop = useDesktop()
  const [deliver, setDeliver] = useState<PoRow | null>(null)

  return (
    <Page className="space-y-5">
      <TopBar title="Purchase orders" subtitle="Invoices are matched against these three-way" action={<RoundBtn icon="plus" label="New purchase order" to="/b/orders/new" />} />
      <div className={desktop ? 'space-y-4' : 'px-[18px]'}>
        {!rows ? (
          <div className="space-y-2.5"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
        ) : !rows.length ? (
          <Empty icon="truck" title="No purchase orders yet">Raise a PO for a supplier. When the goods arrive, record the delivery here.</Empty>
        ) : desktop ? (
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm overflow-x-auto thin-scroll">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="pb-3 pl-2">PO Number</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Supplier</th>
                  <th className="pb-3">Item & Quantity</th>
                  <th className="pb-3 text-right">Unit Price</th>
                  <th className="pb-3 text-right">Total Amount</th>
                  <th className="pb-3 pl-4">Delivery Status</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((po) => {
                  const rec = po.delivery_receipts[0]
                  const supplierObj = names.get(po.supplier_id)
                  const supplierName = supplierObj?.name ?? 'Supplier'
                  return (
                    <tr key={po.id} className="hover:bg-ground/60 transition-colors">
                      <td className="py-3.5 pl-2 font-bold text-ink">{po.po_number}</td>
                      <td className="py-3.5 text-xs text-muted">{day(po.po_date)}</td>
                      <td className="py-3.5 text-ink-3">
                        <div className="font-semibold">{supplierName}</div>
                        {supplierObj?.upi_id && <div className="text-[11px] font-mono text-muted">{supplierObj.upi_id}</div>}
                      </td>
                      <td className="py-3.5 text-xs text-muted">
                        <span className="font-bold text-ink">{fmtQty(po.qty)}</span> × {po.item}
                      </td>
                      <td className="py-3.5 text-right font-medium text-ink">{inr(po.unit_price)}</td>
                      <td className="py-3.5 text-right font-extrabold text-ink">{inr(po.total)}</td>
                      <td className="py-3.5 pl-4">
                        {rec ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1 text-xs font-bold text-ok">
                            <Icon name="check" size={13} width={3} /> {fmtQty(rec.qty_delivered)} units delivered ({rec.grn_number})
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-warn-soft px-3 py-1 text-xs font-bold text-warn">
                            Awaiting delivery
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        {!rec ? (
                          <button onClick={() => setDeliver(po)} className="rounded-xl bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-ink-2 transition">
                            Record delivery
                          </button>
                        ) : (
                          <span className="text-xs text-muted font-medium">{day(rec.delivered_on)}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Stagger className="space-y-2.5">
            {rows.map((po) => {
              const rec = po.delivery_receipts[0]
              const s = names.get(po.supplier_id)
              return (
                <StaggerItem key={po.id}>
                  <Card className="p-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={s?.name ?? 'S'} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold">{po.po_number}</span>
                        <span className="block truncate text-xs text-muted">
                          {s?.name}{s?.upi_id ? ` (${s.upi_id})` : ''} · {fmtQty(po.qty)} × {po.item}
                        </span>
                      </span>
                      <span className="font-bold">{inr(po.total)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[13px]">
                      {rec ? <span className="flex items-center gap-2 font-semibold text-ok"><Icon name="check" size={16} width={2.6} />{fmtQty(rec.qty_delivered)} delivered {day(rec.delivered_on)} · {rec.grn_number}</span>
                        : <><span className="text-warn">Awaiting delivery</span><button onClick={() => setDeliver(po)} className="min-h-10 rounded-full bg-ink px-4 text-[13px] font-semibold text-white">Record delivery</button></>}
                    </div>
                  </Card>
                </StaggerItem>
              )
            })}
          </Stagger>
        )}
      </div>
      <DeliverySheet po={deliver} onClose={() => setDeliver(null)} />
    </Page>
  )
}

function DeliverySheet({ po, onClose }: { po: PoRow | null; onClose: () => void }) {
  const toast = useToast()
  const [qty, setQty] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (po) { setQty(String(po.qty)); setError(null) } }, [po])
  async function save() {
    setBusy(true); setError(null)
    try {
      const r = await call<{ grn_number: string }>('orders', { action: 'record_delivery', po_id: po!.id, qty_delivered: qty, delivered_on: date })
      buzz(20); toast(`Delivery recorded as ${r.grn_number}`); onClose()
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  const short = po && Number(qty) < po.qty
  return (
    <Sheet open={Boolean(po)} onClose={onClose} title={`Record delivery for ${po?.po_number ?? ''}`}>
      <div className="grid grid-cols-2 gap-3">
        <label className="rounded-2xl bg-ground p-3.5"><span className="block text-xs font-semibold text-muted">Units received (of {fmtQty(po?.qty)})</span><input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-full bg-transparent text-lg font-bold outline-none" /></label>
        <label className="rounded-2xl bg-ground p-3.5"><span className="block text-xs font-semibold text-muted">Delivered on</span><input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full bg-transparent text-lg font-bold outline-none" /></label>
      </div>
      {short && <p className="mt-3 rounded-2xl bg-warn-soft px-4 py-3 text-xs text-warn">A short delivery is fine to record: an invoice for more than this will be flagged for the lender.</p>}
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      <Btn className="mt-4 w-full" busy={busy} onClick={save} icon="check">Record delivery (GRN)</Btn>
    </Sheet>
  )
}

export function NewPO() {
  const nav = useNavigate()
  const toast = useToast()
  const desktop = useDesktop()
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [sel, setSel] = useState('')
  const [q, setQ] = useState('')
  const [f, setF] = useState({ po_number: `PO-${Math.floor(4600 + Math.random() * 400)}`, item: '', qty: '', unit_price: '', tax_rate: '18' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { parties(true).then((m) => setSuppliers([...m.values()].filter((p) => p.type === 'supplier'))) }, [])
  const shown = useMemo(() => suppliers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || (s.upi_id && s.upi_id.toLowerCase().includes(q.toLowerCase()))), [suppliers, q])
  const net = round2((Number(f.qty) || 0) * (Number(f.unit_price) || 0))
  const gst = round2(net * (Number(f.tax_rate) || 0) / 100)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!sel) return setError('Choose the supplier.')
    setBusy(true); setError(null)
    try {
      const r = await call<{ po_number: string }>('orders', { action: 'create_po', supplier_id: sel, ...f })
      buzz(20); toast(`${r.po_number} raised`); nav('/b/orders')
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  return (
    <Page className="space-y-5">
      <TopBar back={<RoundBtn icon="back" label="Back" to="/b/orders" />} title="New purchase order" subtitle="Invoices are matched against this order" />
      <form onSubmit={submit} className={desktop ? 'max-w-4xl space-y-5' : 'space-y-3 px-[18px]'}>
        {/* Supplier Selector */}
        <Card className="p-5 border border-line space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">Choose supplier</span>
            <span className="text-[11px] text-muted">Search by name or UPI ID</span>
          </div>
          <label className="flex h-11 items-center gap-2.5 rounded-full bg-ground px-4">
            <Icon name="search" size={18} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or UPI ID (e.g. ravi@invopay)" aria-label="Find a supplier" className="flex-1 bg-transparent text-sm outline-none" />
          </label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
            {shown.map((s) => (
              <button type="button" key={s.id} onClick={() => setSel(s.id)} className="relative min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold">
                {sel === s.id ? <motion.span layoutId="po-sup" transition={spring} className="absolute inset-0 rounded-full bg-ink" /> : <span className="absolute inset-0 rounded-full bg-ground" />}
                <span className={`relative ${sel === s.id ? 'font-bold text-white' : 'text-ink'}`}>
                  {s.name} <span className="text-[10px] opacity-75 font-mono">({s.upi_id})</span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* PO Form Fields */}
        <Card className="p-5 border border-line space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-muted">PO number</span>
              <input required value={f.po_number} onChange={(e) => setF({ ...f, po_number: e.target.value.toUpperCase() })} className="mt-1 block w-full rounded-xl bg-ground px-3.5 py-2.5 text-base font-bold outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted">Item description</span>
              <input required value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} placeholder="Corrugated boxes, 5-ply" className="mt-1 block w-full rounded-xl bg-ground px-3.5 py-2.5 text-base font-bold outline-none placeholder:font-normal placeholder:text-soft" />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {([['qty', 'Quantity units'], ['unit_price', 'Unit price (₹)'], ['tax_rate', 'GST rate (%)']] as const).map(([k, l]) => (
              <label key={k} className="rounded-2xl bg-ground p-3">
                <span className="block text-[11px] font-semibold text-muted">{l}</span>
                <input required inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1 w-full bg-transparent text-lg font-bold outline-none" />
              </label>
            ))}
          </div>
        </Card>

        {/* Live Total Card */}
        <section className="relative flex items-center justify-between overflow-hidden rounded-3xl bg-ink p-5 text-white shadow-md">
          <Rings className="-right-10 -top-8 h-36 w-36" />
          <span className="relative">
            <span className="block text-xs text-soft">Total purchase order value</span>
            <motion.span key={net + gst} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="block text-3xl font-extrabold text-white">
              {inr(net + gst)}
            </motion.span>
          </span>
          <Badge tone="dark" className="relative text-xs py-1.5 px-3">Subtotal {inr(net)} + GST {inr(gst)}</Badge>
        </section>

        <p className="px-1 text-xs text-muted">
          When goods arrive at your warehouse, record the delivery on this PO. Any supplier invoice submitted against it will automatically verify against these line items.
        </p>

        {error && <ErrorNote>{error}</ErrorNote>}
        <Btn type="submit" busy={busy} className="w-full">Raise purchase order {f.po_number || ''}</Btn>
      </form>
    </Page>
  )
}
