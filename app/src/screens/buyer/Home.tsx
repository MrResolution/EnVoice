import { Link } from 'react-router'
import { inr } from '@shared/normalize.ts'
import { useAuth } from '../../lib/auth'
import { useInvoices, useParties, usePOs } from '../../lib/data'
import { Icon, Rings } from '../../ui/Icon'
import { Card, Empty, Skeleton } from '../../ui/kit'
import { CountUp, Page, Stagger, StaggerItem } from '../../ui/motion'
import { InvoiceRowCard } from '../../ui/invoice'

export function BuyerHome() {
  const { profile } = useAuth()
  const { rows } = useInvoices() // RLS: only invoices raised on this buyer, after the supplier submitted
  const { rows: pos } = usePOs()
  const names = useParties()
  const todo = rows?.filter((r) => r.buyer_status === 'pending' && !['rejected', 'offer_released'].includes(r.status)) ?? null
  const confirmed = rows?.filter((r) => r.buyer_status === 'confirmed') ?? []
  const payable = confirmed.reduce((s, r) => s + (r.amount ?? 0), 0)
  const nextDue = confirmed.map((r) => r.due_date).filter(Boolean).sort()[0]
  const awaiting = pos?.filter((p) => !p.delivery_receipts.length).length ?? 0
  const score = rows?.find((r) => r.buyer_score !== null)?.buyer_score

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
  return (
    <Page>
      <header className="px-[18px] pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]"><h1 className="text-2xl font-extrabold">Invoices</h1><p className="text-[13px] text-muted">raised on you by your suppliers</p></header>
      <div className="px-[18px]">
        {!rows ? <Skeleton className="h-40" /> : !rows.length ? <Empty title="No invoices yet">They appear once a supplier submits one against your purchase order.</Empty> : (
          <Stagger className="space-y-2.5">
            {rows.map((inv) => <StaggerItem key={inv.id}><InvoiceRowCard inv={inv} name={names.get(inv.supplier_id)?.name ?? 'Supplier'} to={`/b/invoice/${inv.id}`}
              money={inv.buyer_status === 'pending' && !['rejected', 'offer_released'].includes(inv.status) ? { value: inr(inv.amount), note: 'needs your OK', tone: 'warn' } : undefined} /></StaggerItem>)}
          </Stagger>
        )}
      </div>
    </Page>
  )
}
