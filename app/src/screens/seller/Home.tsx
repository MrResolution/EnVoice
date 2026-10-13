import { Link } from 'react-router'
import { inr } from '@shared/normalize.ts'
import { useAuth } from '../../lib/auth'
import { useInvoices, useOffers, useParties } from '../../lib/data'
import { Icon, Rings, type IconName } from '../../ui/Icon'
import { Card, Empty, Skeleton } from '../../ui/kit'
import { CountUp, Page, Stagger, StaggerItem } from '../../ui/motion'
import { InvoiceRowCard } from '../../ui/invoice'

export function SellerHome() {
  const { profile } = useAuth()
  const { rows } = useInvoices()
  const { rows: offers } = useOffers()
  const names = useParties()
  const received = (offers ?? []).reduce((s, o) => s + o.advance_amount, 0)
  const lender = rows?.filter((r) => r.status === 'review') ?? []
  const buyer = rows?.filter((r) => ['checked', 'approved'].includes(r.status) && r.buyer_status === 'pending') ?? []
  const first = profile?.full_name?.split(' ')[0] ?? 'there'

  const action = (to: string, label: string, icon: IconName, primary?: boolean) => (
    <Link to={to} className="flex flex-col items-center gap-2 text-[13px] text-white transition-transform active:scale-95">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${primary ? 'bg-lime text-ink' : 'bg-ink-3 text-white'}`}><Icon name={icon} size={22} /></span>{label}
    </Link>
  )

  return (
    <Page>
      <section className="relative overflow-hidden rounded-b-[36px] bg-ink px-[18px] pb-[18px] pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <Rings className="-right-20 top-6 h-56 w-56" />
        <div className="relative flex items-center justify-between">
          <span className="text-[15px] text-soft">Hello, <b className="text-white">{first}</b></span>
          <Link to="/s/profile" aria-label="Profile"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime text-sm font-extrabold text-ink">{(profile?.party_name ?? 'S').slice(0, 2).toUpperCase()}</span></Link>
        </div>
        <div className="relative mt-4 text-center">
          <div className="text-sm text-soft">Advances received</div>
          <div className="mt-0.5 text-[38px] font-bold tracking-tight">{offers ? <CountUp value={received} format={inr} /> : '…'}</div>
          <div className="text-xs text-soft">{profile?.party_name}</div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 rounded-3xl bg-ink-2 px-2.5 py-3.5">
          {action('/s/upload?camera=1', 'Scan invoice', 'scan', true)}
          {action('/s/upload', 'Upload file', 'upload')}
          {action('/s/invoices', 'Track', 'clock')}
        </div>
      </section>

      <div className="space-y-3 px-[18px] pt-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Card initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="text-xs text-muted">With the lender</div>
            <div className="mt-1 text-[22px] font-bold">{lender.length} invoice{lender.length === 1 ? '' : 's'}</div>
            <div className={`mt-1 text-xs font-semibold ${lender.length ? 'text-warn' : 'text-muted'}`}>{lender.length ? `${inr(lender.reduce((s, r) => s + (r.amount ?? 0), 0))} · in review` : 'nothing waiting'}</div>
          </Card>
          <Card initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <div className="text-xs text-muted">With the buyer</div>
            <div className="mt-1 text-[22px] font-bold">{buyer.length} invoice{buyer.length === 1 ? '' : 's'}</div>
            <div className="mt-1 text-xs font-semibold text-muted">{buyer.length ? 'waiting for their OK' : 'nothing pending'}</div>
          </Card>
        </div>

        <div className="flex items-center justify-between pt-1"><h2 className="text-[17px] font-bold">Recent invoices</h2><Link to="/s/invoices" className="min-h-11 content-center text-[13px] text-muted">See all</Link></div>
        {!rows ? <div className="space-y-2.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px]" />)}</div>
          : !rows.length ? <Empty icon="scan" title="No invoices yet" action={<Link to="/s/upload" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-lime px-5 font-bold">Scan your first invoice<Icon name="next" size={18} /></Link>}>Your buyer raises a purchase order, you deliver, then scan the invoice here.</Empty>
            : (
              <Stagger className="space-y-2.5">
                {rows.slice(0, 6).map((inv) => {
                  const o = offers?.find((x) => x.invoice_id === inv.id)
                  return (
                    <StaggerItem key={inv.id}>
                      <InvoiceRowCard inv={inv} name={names.get(inv.buyer_id ?? '')?.name ?? 'Buyer not chosen'} to={inv.status === 'extracted' ? `/s/review/${inv.id}` : `/s/invoice/${inv.id}`}
                        money={o ? { value: inr(o.advance_amount), note: o.status === 'accepted' ? `paid out · ${o.advance_pct}%` : `offer · ${o.advance_pct}%`, tone: 'ok' }
                          : inv.status === 'review' ? { value: inr(inv.amount), note: `risk ${inv.risk_score} · review`, tone: 'warn' } : undefined} />
                    </StaggerItem>
                  )
                })}
              </Stagger>
            )}
        <div className="flex items-center gap-2 px-1 pt-2 text-xs text-muted"><Icon name="shield" size={16} />AI reads your invoice, 21 rules decide, every step is hash-chained.</div>
      </div>
    </Page>
  )
}
