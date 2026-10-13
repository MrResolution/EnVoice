import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { inr, day } from '@shared/normalize.ts'
import { useInvoices, useOffers, useParties, type InvoiceRow } from '../../lib/data'
import { useDesktop } from '../../lib/layout'
import { Icon } from '../../ui/Icon'
import { Card, DarkCard, Empty, Skeleton } from '../../ui/kit'
import { CountUp, Page, spring, Stagger, StaggerItem } from '../../ui/motion'
import { TopBar } from '../../ui/MobileShell'
import { InvoiceRowCard, StatusBadge } from '../../ui/invoice'

const FILTERS: [string, string, (r: InvoiceRow) => boolean][] = [
  ['all', 'All', () => true],
  ['open', 'In progress', (r) => ['extracted', 'checked', 'review', 'approved'].includes(r.status)],
  ['paid', 'Offers', (r) => r.status === 'offer_released'],
  ['stopped', 'Rejected', (r) => r.status === 'rejected'],
]

export function SellerInvoices() {
  const { rows } = useInvoices()
  const { rows: offers } = useOffers()
  const names = useParties()
  const desktop = useDesktop()
  const [f, setF] = useState('all')
  const [q, setQ] = useState('')

  const activeFilter = FILTERS.find((x) => x[0] === f)![2]
  const shown = rows?.filter(activeFilter).filter((r) => {
    if (!q) return true
    const buyer = names.get(r.buyer_id ?? '')?.name ?? ''
    const buyerUpi = names.get(r.buyer_id ?? '')?.upi_id ?? ''
    return `${r.invoice_no ?? ''} ${buyer} ${buyerUpi}`.toLowerCase().includes(q.toLowerCase())
  })

  return (
    <Page className="space-y-5">
      <TopBar title="Invoices" subtitle="Live updates as buyers confirm and lenders decide" action={desktop ? (
        <Link to="/s/upload" className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-lime px-4 text-xs font-bold text-ink hover:bg-lime-deep transition">
          <Icon name="upload" size={14} /> New invoice
        </Link>
      ) : undefined} />

      <div className={desktop ? 'space-y-4' : 'space-y-3 px-[18px]'}>
        {/* Controls Row: Filters + Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div role="tablist" className={`flex gap-1 overflow-x-auto no-scrollbar ${desktop ? '' : '-mx-[18px] px-[18px]'}`}>
            {FILTERS.map(([k, label, fn]) => (
              <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)} className="relative min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold">
                {f === k && <motion.span layoutId="inv-filter" transition={spring} className="absolute inset-0 rounded-full bg-ink" />}
                <span className={`relative ${f === k ? 'font-bold text-white' : 'text-ink-3'}`}>
                  {label} {rows ? <span className="opacity-70">({rows.filter(fn).length})</span> : ''}
                </span>
              </button>
            ))}
          </div>

          <label className="flex h-10 items-center gap-2 rounded-full bg-white px-3.5 text-xs ring-1 ring-line w-full sm:w-64">
            <Icon name="search" size={16} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by invoice or buyer" className="w-full bg-transparent outline-none" />
          </label>
        </div>

        {/* Content: Desktop Table vs Mobile Cards */}
        {!shown ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : !shown.length ? (
          <Empty title="Nothing here">Invoices appear as soon as you upload one.</Empty>
        ) : desktop ? (
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm overflow-x-auto thin-scroll">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="pb-3 pl-2">Invoice #</th>
                  <th className="pb-3">Buyer</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Due Date</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 pl-4">Advance</th>
                  <th className="pb-3">Risk</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((inv) => {
                  const o = offers?.find((x) => x.invoice_id === inv.id)
                  const buyerObj = names.get(inv.buyer_id ?? '')
                  const buyerName = buyerObj?.name ?? 'Buyer not chosen'
                  const to = inv.status === 'extracted' ? `/s/review/${inv.id}` : `/s/invoice/${inv.id}`
                  return (
                    <tr key={inv.id} className="hover:bg-ground/60 transition-colors">
                      <td className="py-3.5 pl-2 font-bold text-ink">
                        <Link to={to} className="hover:underline">{inv.invoice_no ?? 'Draft'}</Link>
                      </td>
                      <td className="py-3.5 text-ink-3">
                        <div className="font-medium">{buyerName}</div>
                        {buyerObj?.upi_id && <div className="text-[11px] font-mono text-muted">{buyerObj.upi_id}</div>}
                      </td>
                      <td className="py-3.5 text-xs text-muted">{day(inv.invoice_date ?? inv.created_at)}</td>
                      <td className="py-3.5 text-xs text-muted">{inv.due_date ? day(inv.due_date) : '—'}</td>
                      <td className="py-3.5 text-right font-bold text-ink">{inr(inv.amount)}</td>
                      <td className="py-3.5 pl-4">
                        {o ? (
                          <span className="font-bold text-ok">{inr(o.advance_amount)} <span className="text-xs font-normal text-muted">({o.advance_pct}%)</span></span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3.5">
                        {inv.risk_level ? (
                          <span className={`text-xs font-bold ${inv.risk_level === 'LOW' ? 'text-ok' : inv.risk_level === 'MEDIUM' ? 'text-warn' : 'text-bad'}`}>
                            {inv.risk_level} ({inv.risk_score})
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3.5"><StatusBadge inv={inv} /></td>
                      <td className="py-3.5 text-right pr-2">
                        <Link to={to} className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
                          {inv.status === 'extracted' ? 'Review →' : 'Details →'}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Stagger className="space-y-2.5">
            {shown.map((inv) => {
              const b = names.get(inv.buyer_id ?? '')
              return (
                <StaggerItem key={inv.id}>
                  <InvoiceRowCard inv={inv} name={b?.name ?? 'Buyer not chosen'} upi_id={b?.upi_id} to={inv.status === 'extracted' ? `/s/review/${inv.id}` : `/s/invoice/${inv.id}`} />
                </StaggerItem>
              )
            })}
          </Stagger>
        )}
      </div>
    </Page>
  )
}

export function Payouts() {
  const { rows: offers } = useOffers()
  const { rows: invoices } = useInvoices()
  const names = useParties()
  const desktop = useDesktop()

  const total = (offers ?? []).reduce((s, o) => s + o.advance_amount, 0)
  const fees = (offers ?? []).reduce((s, o) => s + o.fee_amount, 0)

  return (
    <Page className="space-y-5">
      <TopBar title="Payouts" subtitle="Advances released against your verified invoices" />
      <div className={desktop ? 'space-y-5' : 'space-y-3 px-[18px]'}>
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DarkCard className="p-5" ringsAt="-right-12 -top-12 h-44 w-44">
            <div className="text-xs font-semibold text-soft">Total advanced</div>
            <div className="mt-1 text-3xl font-extrabold text-white">{offers ? <CountUp value={total} format={inr} /> : '…'}</div>
            <div className="mt-2 text-xs text-lime font-bold">{offers?.length ?? 0} financing offers</div>
          </DarkCard>

          <Card className="p-5 border border-line">
            <div className="text-xs font-semibold text-muted">Platform fees (mock)</div>
            <div className="mt-1 text-3xl font-extrabold text-ink">{offers ? <CountUp value={fees} format={inr} /> : '…'}</div>
            <div className="mt-2 text-xs text-muted">1.5% fee per 30 days</div>
          </Card>

          <Card className="p-5 border border-line">
            <div className="text-xs font-semibold text-muted">Accepted by you</div>
            <div className="mt-1 text-3xl font-extrabold text-ink">
              {offers?.filter(o => o.status === 'accepted').length ?? 0} / {offers?.length ?? 0}
            </div>
            <div className="mt-2 text-xs text-ok font-semibold">Instant payout simulation</div>
          </Card>
        </div>

        {/* Offers Table / List */}
        {!offers ? (
          <Skeleton className="h-40 w-full" />
        ) : !offers.length ? (
          <Empty icon="wallet" title="No advances yet">When a buyer confirms a checked invoice, the lender offer appears here.</Empty>
        ) : desktop ? (
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm overflow-x-auto thin-scroll">
            <h2 className="text-base font-bold mb-4">Advance history</h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="pb-3 pl-2">Invoice #</th>
                  <th className="pb-3">Buyer</th>
                  <th className="pb-3 text-right">Invoice Amount</th>
                  <th className="pb-3 pl-4">Advance Rate</th>
                  <th className="pb-3 text-right">Advance Amount</th>
                  <th className="pb-3 text-right">Fee (1.5%)</th>
                  <th className="pb-3 pl-4">Status</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {offers.map((o) => {
                  const inv = invoices?.find((i) => i.id === o.invoice_id)
                  const buyerName = inv?.buyer_id ? names.get(inv.buyer_id)?.name ?? '—' : '—'
                  return (
                    <tr key={o.invoice_id} className="hover:bg-ground/60 transition-colors">
                      <td className="py-3.5 pl-2 font-bold text-ink">
                        <Link to={`/s/invoice/${o.invoice_id}`} className="hover:underline">{inv?.invoice_no ?? 'Invoice'}</Link>
                      </td>
                      <td className="py-3.5 text-ink-3">{buyerName}</td>
                      <td className="py-3.5 text-right font-semibold text-ink">{inv ? inr(inv.amount) : '—'}</td>
                      <td className="py-3.5 pl-4 font-bold text-ok">{o.advance_pct}%</td>
                      <td className="py-3.5 text-right font-extrabold text-ink">{inr(o.advance_amount)}</td>
                      <td className="py-3.5 text-right text-muted">{inr(o.fee_amount)}</td>
                      <td className="py-3.5 pl-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${o.status === 'accepted' ? 'bg-ok-soft text-ok' : 'bg-lime text-ink'}`}>
                          {o.status === 'accepted' ? '✓ Paid out' : 'Offer ready'}
                        </span>
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        <Link to={`/s/invoice/${o.invoice_id}`} className="text-xs font-bold text-ink hover:underline">
                          Open invoice →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Stagger className="space-y-2.5">
            {offers.map((o) => {
              const inv = invoices?.find((i) => i.id === o.invoice_id)
              return (
                <StaggerItem key={o.invoice_id}>
                  <Link to={`/s/invoice/${o.invoice_id}`} className="flex items-center gap-3 rounded-[22px] bg-white p-3.5">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${o.status === 'accepted' ? 'bg-ink text-lime' : 'bg-lime text-ink'}`}>
                      <Icon name={o.status === 'accepted' ? 'check' : 'down'} size={20} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-bold">{inv?.invoice_no ?? 'Invoice'}</span>
                      <span className="block text-xs text-muted">{o.status === 'accepted' ? 'accepted · mock payout' : 'offer waiting for you'}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-bold">{inr(o.advance_amount)}</span>
                      <span className="block text-xs font-semibold text-ok">{o.advance_pct}%</span>
                    </span>
                  </Link>
                </StaggerItem>
              )
            })}
          </Stagger>
        )}
      </div>
    </Page>
  )
}
