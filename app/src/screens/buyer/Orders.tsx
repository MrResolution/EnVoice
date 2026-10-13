import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { day, inr, qty as fmtQty, round2 } from '@shared/normalize.ts'
import { call } from '../../lib/supabase'
import { parties, useParties, usePOs, type Party, type PoRow } from '../../lib/data'
import { Icon, Rings } from '../../ui/Icon'
import { Avatar, Badge, Btn, Card, Empty, ErrorNote, RoundBtn, Skeleton } from '../../ui/kit'
import { buzz, Page, Sheet, spring, Stagger, StaggerItem, useToast } from '../../ui/motion'
import { TopBar } from '../../ui/MobileShell'

export function Orders() {
  const { rows } = usePOs()
  const names = useParties()
  const [deliver, setDeliver] = useState<PoRow | null>(null)
  return (
    <Page>
      <TopBar title="Purchase orders" subtitle="invoices are matched against these" action={<RoundBtn icon="plus" label="New purchase order" to="/b/orders/new" />} />
      <div className="px-[18px]">
        {!rows ? <div className="space-y-2.5"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : !rows.length ? (
          <Empty icon="truck" title="No purchase orders yet">Raise a PO for a supplier. When the goods arrive, record the delivery here.</Empty>
        ) : (
          <Stagger className="space-y-2.5">
            {rows.map((po) => {
              const rec = po.delivery_receipts[0]
              return (
                <StaggerItem key={po.id}>
                  <Card className="p-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={names.get(po.supplier_id)?.name ?? 'S'} />
                      <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{po.po_number}</span><span className="block truncate text-xs text-muted">{names.get(po.supplier_id)?.name} · {fmtQty(po.qty)} × {po.item}</span></span>
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
    <Sheet open={Boolean(po)} onClose={onClose} title={`What arrived for ${po?.po_number ?? ''}?`}>
      <div className="grid grid-cols-2 gap-2">
        <label className="rounded-2xl bg-ground p-3"><span className="block text-xs text-muted">Units received (of {fmtQty(po?.qty)})</span><input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-full bg-transparent text-lg font-bold outline-none" /></label>
        <label className="rounded-2xl bg-ground p-3"><span className="block text-xs text-muted">Delivered on</span><input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full bg-transparent text-lg font-bold outline-none" /></label>
      </div>
      {short && <p className="mt-3 rounded-2xl bg-warn-soft px-4 py-3 text-[13px] text-warn">A short delivery is fine to record: an invoice for more than this will be flagged for the lender.</p>}
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      <Btn className="mt-4 w-full" busy={busy} onClick={save} icon="check">Record delivery</Btn>
    </Sheet>
  )
}

export function NewPO() {
  const nav = useNavigate()
  const toast = useToast()
  const [suppliers, setSuppliers] = useState<Party[]>([])
  const [sel, setSel] = useState('')
  const [q, setQ] = useState('')
  const [f, setF] = useState({ po_number: `PO-${Math.floor(4600 + Math.random() * 400)}`, item: '', qty: '', unit_price: '', tax_rate: '18' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { parties(true).then((m) => setSuppliers([...m.values()].filter((p) => p.type === 'supplier'))) }, [])
  const shown = useMemo(() => suppliers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())), [suppliers, q])
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
    <Page>
      <TopBar back={<RoundBtn icon="back" label="Back" to="/b/orders" />} title="New purchase order" subtitle="invoices are matched against it" />
      <form onSubmit={submit} className="space-y-3 px-[18px]">
        <label className="flex h-[54px] items-center gap-2.5 rounded-full bg-white px-[18px]"><Icon name="search" size={20} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a supplier" aria-label="Find a supplier" className="flex-1 bg-transparent text-base outline-none" /></label>
        <div className="no-scrollbar -mx-[18px] flex gap-2 overflow-x-auto px-[18px]">
          {shown.map((s) => (
            <button type="button" key={s.id} onClick={() => setSel(s.id)} className="relative min-h-11 shrink-0 rounded-full px-4 text-[13px]">
              {sel === s.id ? <motion.span layoutId="po-sup" transition={spring} className="absolute inset-0 rounded-full bg-ink" /> : <span className="absolute inset-0 rounded-full bg-white" />}
              <span className={`relative ${sel === s.id ? 'font-semibold text-white' : ''}`}>{s.name}</span>
            </button>
          ))}
        </div>
        <Card className="space-y-3">
          <label className="block"><span className="text-xs text-muted">PO number</span><input required value={f.po_number} onChange={(e) => setF({ ...f, po_number: e.target.value.toUpperCase() })} className="mt-0.5 block w-full bg-transparent text-[17px] font-bold outline-none" /></label>
          <label className="block border-t border-line pt-3"><span className="text-xs text-muted">Item</span><input required value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} placeholder="Corrugated boxes, 5-ply" className="mt-0.5 block w-full bg-transparent text-[17px] font-bold outline-none placeholder:font-medium placeholder:text-soft" /></label>
          <div className="grid grid-cols-3 gap-2">
            {([['qty', 'Quantity'], ['unit_price', 'Unit ₹'], ['tax_rate', 'GST %']] as const).map(([k, l]) => (
              <label key={k} className="rounded-2xl bg-ground p-2.5"><span className="block text-[11px] text-muted">{l}</span><input required inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-0.5 w-full bg-transparent text-base font-bold outline-none" /></label>
            ))}
          </div>
        </Card>
        <section className="relative flex items-center justify-between overflow-hidden rounded-[22px] bg-ink px-[18px] py-4 text-white">
          <Rings className="-right-10 -top-8 h-32 w-32" />
          <span className="relative"><span className="block text-xs text-soft">PO total incl. GST</span><motion.span key={net + gst} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="block text-[26px] font-bold">{inr(net + gst)}</motion.span></span>
          <Badge tone="dark" className="relative">{inr(net)} + {inr(gst)}</Badge>
        </section>
        <p className="px-1 text-xs leading-relaxed text-muted">When the goods arrive, record the delivery on this PO. An invoice without a delivery record is rejected.</p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Btn type="submit" busy={busy} className="w-full">Raise {f.po_number || 'PO'}</Btn>
      </form>
    </Page>
  )
}
