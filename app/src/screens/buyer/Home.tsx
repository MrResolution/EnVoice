import { Link } from 'react-router'
import { inr, day } from '@shared/normalize.ts'
import { useAuth } from '../../lib/auth'
import { useInvoices, useParties, usePOs } from '../../lib/data'
import { useDesktop } from '../../lib/layout'
import { Icon, Rings } from '../../ui/Icon'
import { Card, DarkCard, Empty, Skeleton } from '../../ui/kit'
import { CountUp, Page, Stagger, StaggerItem } from '../../ui/motion'
import { InvoiceRowCard, StatusBadge } from '../../ui/invoice'

export function BuyerHome() {
  const { profile } = useAuth()
  const { rows } = useInvoices() // RLS: only invoices raised on this buyer, after the supplier submitted
  const { rows: pos } = usePOs()
  const names = useParties()
  const desktop = useDesktop()

  const todo = rows?.filter((r) => r.buyer_status === 'pending' && !['rejected', 'offer_released'].includes(r.status)) ?? null
  const confirmed = rows?.filter((r) => r.buyer_status === 'confirmed') ?? []
  const payable = confirmed.reduce((s, r) => s + (r.amount ?? 0), 0)
  const nextDue = confirmed.map((r) => r.due_date).filter(Boolean).sort()[0]
  const awaiting = pos?.filter((p) => !p.delivery_receipts.length).length ?? 0
  const score = rows?.find((r) => r.buyer_score !== null)?.buyer_score

  if (desktop) {
    return (
      <Page className="space-y-6">
        {/* Executive Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              Hello, {profile?.party_name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Buyer Portal · Manage purchase orders, confirm goods delivered, release supplier financing
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/b/orders" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold ring-1 ring-line hover:bg-ground transition">
              <Icon name="truck" size={16} /> View purchase orders
            </Link>
            <Link to="/b/orders/new" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-lime px-5 text-sm font-bold text-ink hover:bg-lime-deep transition shadow-sm">
              <Icon name="plus" size={16} /> New purchase order
            </Link>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DarkCard className="p-5" ringsAt="-bottom-10 -right-10 h-36 w-36">
            <div className="text-xs font-semibold text-soft">Confirmed payables</div>
            <div className="mt-1.5 text-3xl font-extrabold text-white">
              {rows ? <CountUp value={payable} format={inr} /> : '…'}
            </div>
            <div className="mt-2 text-xs text-lime font-bold">
              {confirmed.length} invoice{confirmed.length === 1 ? '' : 's'} {nextDue ? `· next due ${new Date(nextDue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
            </div>
          </DarkCard>

          <Card className="p-5 border border-line">
            <div className="text-xs font-semibold text-muted">Buyer credit rating</div>
            <div className="mt-1.5 text-3xl font-extrabold text-ink">{score ?? '—'} <span className="text-sm font-normal text-muted">/ 100</span></div>
            <div className="mt-2 text-xs text-muted">
              {score === undefined || score === null ? 'Calculated on first invoice' : score >= 80 ? 'Grade A · 85% advances unlocked' : score >= 70 ? 'Grade B · 75% advances' : 'Lender reviews each invoice'}
            </div>
          </Card>

          <Card className="p-5 border border-line">
            <div className="text-xs font-semibold text-muted">Active purchase orders</div>
            <div className="mt-1.5 text-3xl font-extrabold text-ink">{pos?.length ?? '—'}</div>
            <div className={`mt-2 text-xs font-semibold ${awaiting ? 'text-warn' : 'text-ok'}`}>
              {awaiting ? `${awaiting} awaiting goods delivery` : 'All deliveries fulfilled'}
            </div>
          </Card>

          <Card className="p-5 border border-line">
            <div className="text-xs font-semibold text-muted">Needs your confirmation</div>
            <div className="mt-1.5 text-3xl font-extrabold text-ink">{todo?.length ?? 0}</div>
            <div className={`mt-2 text-xs font-semibold ${todo?.length ? 'text-warn' : 'text-ok'}`}>
              {todo?.length ? 'Pending your review' : 'All invoices confirmed'}
            </div>
          </Card>
        </div>

        {/* Invoices Needing Confirmation Desktop Table */}
        <section className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">Invoices awaiting confirmation</h2>
              <p className="text-xs text-muted">Your confirmation releases the supplier advance. Confirm only if goods have arrived.</p>
            </div>
            <Link to="/b/invoices" className="text-xs font-bold text-muted hover:text-ink underline-offset-2 hover:underline">
              All supplier invoices →
            </Link>
          </div>

          {!todo ? (
            <Skeleton className="h-32 w-full" />
          ) : !todo.length ? (
            <Empty icon="check" title="Nothing to confirm" action={<Link to="/b/orders/new" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-lime px-5 text-sm font-bold text-ink">Raise a purchase order<Icon name="next" size={16} /></Link>}>
              When suppliers deliver and upload invoices against your POs, they appear here after 21 verification checks pass.
            </Empty>
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold text-muted">
                    <th className="pb-3 pl-2">Invoice #</th>
                    <th className="pb-3">Supplier</th>
                    <th className="pb-3">PO Number</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3 pl-4">Due Date</th>
                    <th className="pb-3">Risk Assessment</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {todo.map((inv) => {
                    const supplierObj = names.get(inv.supplier_id)
                    const supplierName = supplierObj?.name ?? 'Supplier'
                    return (
                      <tr key={inv.id} className="hover:bg-ground/60 transition-colors">
                        <td className="py-3.5 pl-2 font-bold text-ink">
                          <Link to={`/b/invoice/${inv.id}`} className="hover:underline">{inv.invoice_no ?? 'Invoice'}</Link>
                        </td>
                        <td className="py-3.5 text-ink-3">
                          <div className="font-semibold">{supplierName}</div>
                          {supplierObj?.upi_id && <div className="text-[11px] font-mono text-muted">{supplierObj.upi_id}</div>}
                        </td>
                        <td className="py-3.5 text-xs text-muted font-mono">{inv.po_number ?? '—'}</td>
                        <td className="py-3.5 text-right font-bold text-ink">{inr(inv.amount)}</td>
                        <td className="py-3.5 pl-4 text-xs text-muted">{inv.due_date ? day(inv.due_date) : '—'}</td>
                        <td className="py-3.5">
                          <span className={`text-xs font-bold ${inv.risk_level === 'LOW' ? 'text-ok' : inv.risk_level === 'MEDIUM' ? 'text-warn' : 'text-bad'}`}>
                            {inv.risk_level ?? 'PASS'} ({inv.risk_score ?? 0})
                          </span>
                        </td>
                        <td className="py-3.5"><StatusBadge inv={inv} /></td>
                        <td className="py-3.5 text-right pr-2">
                          <Link to={`/b/invoice/${inv.id}`} className="rounded-xl bg-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-ink-2 transition inline-flex items-center gap-1">
                            Review & Confirm →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Page>
    )
  }

  // MOBILE PHONE VIEW
  return (
    <Page>
      <header className="flex items-center gap-2.5 px-[18px] pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <span className="flex-1 truncate text-lg">Hello, <b>{profile?.party_name}</b></span>
        <Link to="/b/profile" aria-label="Profile" className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-lime">{(profile?.party_name ?? 'B').slice(0, 2).toUpperCase()}</Link>
      </header>
      <div className="space-y-3 px-[18px]">
        <section className="relative overflow-hidden rounded-[26px] bg-ink text-white">
          <div className="flex justify-between rounded-br-[22px] bg-lime px-[18px] py-3 text-sm text-ink"><b>Your payables</b><span>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
          <Rings className="-bottom-12 -right-10 h-36 w-36" />
          <div className="relative flex items-end justify-between px-[18px] pb-5 pt-4">
            <div><div className="text-[13px] text-soft">Confirmed{nextDue ? `, next due ${new Date(nextDue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</div><div className="mt-0.5 text-[30px] font-bold">{rows ? <CountUp value={payable} format={inr} /> : '…'}</div></div>
            <span className="text-[13px] font-semibold text-lime">{confirmed.length} invoice{confirmed.length === 1 ? '' : 's'}</span>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <Card className="p-3.5"><div className="text-xs text-muted">Your credit score</div><div className="mt-0.5 text-2xl font-bold">{score ?? '—'}</div><div className="mt-0.5 text-xs text-muted">{score === undefined || score === null ? 'shown after the first invoice' : score >= 80 ? 'sellers get 85% advances' : score >= 70 ? 'sellers get 75% advances' : 'a lender reviews each invoice'}</div></Card>
          <Link to="/b/orders" className="rounded-[24px] bg-white p-3.5"><div className="text-xs text-muted">Open orders</div><div className="mt-0.5 text-2xl font-bold">{pos?.length ?? '—'} PO{pos?.length === 1 ? '' : 's'}</div><div className={`mt-0.5 text-xs ${awaiting ? 'font-semibold text-warn' : 'text-muted'}`}>{awaiting ? `${awaiting} awaiting delivery` : 'all delivered'}</div></Link>
        </div>

        <div className="flex items-center justify-between pt-1"><h2 className="text-[17px] font-bold">Needs your OK</h2><Link to="/b/invoices" className="min-h-11 content-center text-[13px] text-muted">See all</Link></div>
        {!todo ? <Skeleton className="h-24" /> : !todo.length ? (
          <Empty icon="check" title="Nothing to confirm" action={<Link to="/b/orders/new" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-lime px-5 font-bold">Raise a purchase order<Icon name="next" size={18} /></Link>}>
            Invoices your suppliers raise on you appear here after the checks run.
          </Empty>
        ) : (
          <Stagger className="space-y-2.5">
            {todo.map((inv) => (
              <StaggerItem key={inv.id}>
                <InvoiceRowCard inv={inv} name={names.get(inv.supplier_id)?.name ?? 'Supplier'} to={`/b/invoice/${inv.id}`}
                  money={{ value: inr(inv.amount), note: inv.status === 'review' ? 'lender reviewing' : `${inv.risk_score === 0 ? 'all checks passed' : `risk ${inv.risk_score}`}`, tone: inv.status === 'review' ? 'warn' : 'ok' }} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </Page>
  )
}

export function BuyerInvoices() {
  const { rows } = useInvoices()
  const names = useParties()
  const desktop = useDesktop()

  return (
    <Page className="space-y-5">
      <header className={desktop ? 'border-b border-line pb-4' : 'px-[18px] pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]'}>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-ink">Invoices</h1>
        <p className="text-xs text-muted">All invoices raised on your business by registered suppliers</p>
      </header>

      <div className={desktop ? '' : 'px-[18px]'}>
        {!rows ? (
          <Skeleton className="h-40 w-full" />
        ) : !rows.length ? (
          <Empty title="No invoices yet">They appear once a supplier submits one against your purchase order.</Empty>
        ) : desktop ? (
          <div className="rounded-3xl border border-line bg-white p-6 shadow-sm overflow-x-auto thin-scroll">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold text-muted">
                  <th className="pb-3 pl-2">Invoice #</th>
                  <th className="pb-3">Supplier</th>
                  <th className="pb-3">PO Number</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 pl-4">Due Date</th>
                  <th className="pb-3">Risk Assessment</th>
                  <th className="pb-3">Confirmation Status</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((inv) => {
                  const supplierObj = names.get(inv.supplier_id)
                  const supplierName = supplierObj?.name ?? 'Supplier'
                  return (
                    <tr key={inv.id} className="hover:bg-ground/60 transition-colors">
                      <td className="py-3.5 pl-2 font-bold text-ink">
                        <Link to={`/b/invoice/${inv.id}`} className="hover:underline">{inv.invoice_no ?? 'Invoice'}</Link>
                      </td>
                      <td className="py-3.5 text-ink-3">
                        <div className="font-semibold">{supplierName}</div>
                        {supplierObj?.upi_id && <div className="text-[11px] font-mono text-muted">{supplierObj.upi_id}</div>}
                      </td>
                      <td className="py-3.5 text-xs text-muted font-mono">{inv.po_number ?? '—'}</td>
                      <td className="py-3.5 text-right font-bold text-ink">{inr(inv.amount)}</td>
                      <td className="py-3.5 pl-4 text-xs text-muted">{inv.due_date ? day(inv.due_date) : '—'}</td>
                      <td className="py-3.5">
                        <span className={`text-xs font-bold ${inv.risk_level === 'LOW' ? 'text-ok' : inv.risk_level === 'MEDIUM' ? 'text-warn' : 'text-bad'}`}>
                          {inv.risk_level ?? 'PASS'} ({inv.risk_score ?? 0})
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          inv.buyer_status === 'confirmed' ? 'bg-ok-soft text-ok' : inv.buyer_status === 'disputed' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'
                        }`}>
                          {inv.buyer_status === 'confirmed' ? '✓ Confirmed' : inv.buyer_status === 'disputed' ? 'Disputed' : 'Pending OK'}
                        </span>
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        <Link to={`/b/invoice/${inv.id}`} className="text-xs font-bold text-ink hover:underline">
                          View details →
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
            {rows.map((inv) => {
              const s = names.get(inv.supplier_id)
              return (
                <StaggerItem key={inv.id}>
                  <InvoiceRowCard inv={inv} name={s?.name ?? 'Supplier'} upi_id={s?.upi_id} to={`/b/invoice/${inv.id}`}
                    money={inv.buyer_status === 'pending' && !['rejected', 'offer_released'].includes(inv.status) ? { value: inr(inv.amount), note: 'needs your OK', tone: 'warn' } : undefined} />
                </StaggerItem>
              )
            })}
          </Stagger>
        )}
      </div>
    </Page>
  )
}
