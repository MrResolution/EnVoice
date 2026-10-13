import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { inr } from '@shared/normalize.ts'
import { useInvoices, useOffers, useParties, type InvoiceRow } from '../../lib/data'
import { Icon } from '../../ui/Icon'
import { DarkCard, Empty, Skeleton } from '../../ui/kit'
import { CountUp, Page, spring, Stagger, StaggerItem } from '../../ui/motion'
import { TopBar } from '../../ui/MobileShell'
import { InvoiceRowCard } from '../../ui/invoice'

const FILTERS: [string, string, (r: InvoiceRow) => boolean][] = [
  ['all', 'All', () => true],
  ['open', 'In progress', (r) => ['extracted', 'checked', 'review', 'approved'].includes(r.status)],
  ['paid', 'Offers', (r) => r.status === 'offer_released'],
  ['stopped', 'Rejected', (r) => r.status === 'rejected'],
]

export function SellerInvoices() {
  const { rows } = useInvoices()
  const names = useParties()
  const [f, setF] = useState('all')
  const shown = rows?.filter(FILTERS.find((x) => x[0] === f)![2])
  return (
    <Page>
      <TopBar title="Invoices" subtitle="live: updates as buyers and lenders act" />
      <div className="space-y-3 px-[18px]">
        <div role="tablist" className="no-scrollbar -mx-[18px] flex gap-1 overflow-x-auto px-[18px]">
          {FILTERS.map(([k, label, fn]) => (
            <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)} className="relative min-h-11 shrink-0 rounded-full px-4 text-[13px]">
              {f === k && <motion.span layoutId="inv-filter" transition={spring} className="absolute inset-0 rounded-full bg-ink" />}
              <span className={`relative ${f === k ? 'font-semibold text-white' : 'text-ink-3'}`}>{label} {rows ? rows.filter(fn).length : ''}</span>
            </button>
          ))}
        </div>
        {!shown ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px]" />)
          : !shown.length ? <Empty title="Nothing here">Invoices appear as soon as you scan one.</Empty>
            : <Stagger className="space-y-2.5">{shown.map((inv) => (
              <StaggerItem key={inv.id}><InvoiceRowCard inv={inv} name={names.get(inv.buyer_id ?? '')?.name ?? 'Buyer not chosen'} to={inv.status === 'extracted' ? `/s/review/${inv.id}` : `/s/invoice/${inv.id}`} /></StaggerItem>
            ))}</Stagger>}
      </div>
    </Page>
  )
}

export function Payouts() {
  const { rows: offers } = useOffers()
  const { rows: invoices } = useInvoices()
  const total = (offers ?? []).reduce((s, o) => s + o.advance_amount, 0)
  const fees = (offers ?? []).reduce((s, o) => s + o.fee_amount, 0)
  return (
    <Page>
      <TopBar title="Payouts" subtitle="advances against your invoices" />
      <div className="space-y-3 px-[18px]">
        <DarkCard className="p-5" ringsAt="-right-12 -top-12 h-44 w-44">
          <div className="text-sm text-soft">Total advanced</div>
          <div className="mt-1 text-[34px] font-bold">{offers ? <CountUp value={total} format={inr} /> : '…'}</div>
          <div className="mt-3 flex gap-2 text-xs"><span className="rounded-full bg-ink-2 px-3 py-1.5 text-lime">{offers?.length ?? 0} offers</span><span className="rounded-full bg-ink-2 px-3 py-1.5 text-soft">fees {inr(fees)}</span></div>
        </DarkCard>
        {!offers ? <Skeleton className="h-40" /> : !offers.length ? <Empty icon="wallet" title="No advances yet">When a buyer confirms a checked invoice, the offer appears here.</Empty> : (
          <Stagger className="space-y-2.5">
            {offers.map((o) => {
              const inv = invoices?.find((i) => i.id === o.invoice_id)
              return (
                <StaggerItem key={o.invoice_id}>
                  <Link to={`/s/invoice/${o.invoice_id}`} className="flex items-center gap-3 rounded-[22px] bg-white p-3.5">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${o.status === 'accepted' ? 'bg-ink text-lime' : 'bg-lime text-ink'}`}><Icon name={o.status === 'accepted' ? 'check' : 'down'} size={20} /></span>
                    <span className="flex-1"><span className="block text-[15px] font-bold">{inv?.invoice_no ?? 'Invoice'}</span><span className="block text-xs text-muted">{o.status === 'accepted' ? 'accepted · mock payout' : 'offer waiting for you'}</span></span>
                    <span className="text-right"><span className="block font-bold">{inr(o.advance_amount)}</span><span className="block text-xs font-semibold text-ok">{o.advance_pct}%</span></span>
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
