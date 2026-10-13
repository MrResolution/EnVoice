import { Link } from 'react-router'
import { inr, day } from '@shared/normalize.ts'
import { useAuth } from '../../lib/auth'
import { useInvoices, useOffers, useParties } from '../../lib/data'
import { useDesktop } from '../../lib/layout'
import { Icon, Rings, type IconName } from '../../ui/Icon'
import { Card, DarkCard, Empty, Skeleton } from '../../ui/kit'
import { CountUp, Page, Stagger, StaggerItem } from '../../ui/motion'
import { InvoiceRowCard, StatusBadge } from '../../ui/invoice'

export function SellerHome() {
  const { profile } = useAuth()
  const { rows } = useInvoices()
  const { rows: offers } = useOffers()
  const names = useParties()
  const desktop = useDesktop()

  const received = (offers ?? []).reduce((s, o) => s + o.advance_amount, 0)
  const lender = rows?.filter((r) => r.status === 'review') ?? []
  const buyer = rows?.filter((r) => ['checked', 'approved'].includes(r.status) && r.buyer_status === 'pending') ?? []
  const first = profile?.full_name?.split(' ')[0] ?? 'there'

  const action = (to: string, label: string, icon: IconName, primary?: boolean) => (
    <Link to={to} className="flex flex-col items-center gap-2 text-[13px] text-white transition-transform active:scale-95">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${primary ? 'bg-lime text-ink' : 'bg-ink-3 text-white'}`}><Icon name={icon} size={22} /></span>{label}
    </Link>
  )

  // DESKTOP LAPTOP INTERFACE
  if (desktop) {
    return (
      <Page className="space-y-6">
        {/* Executive Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              Welcome back, {first}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {profile?.party_name} · Supplier Portal · Live invoice financing pipeline
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/s/invoices" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold ring-1 ring-line hover:bg-ground transition">
              <Icon name="clock" size={16} /> Track all invoices
            </Link>
            <Link to="/s/upload" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-lime px-5 text-sm font-bold text-ink hover:bg-lime-deep transition shadow-sm">
              <Icon name="upload" size={16} /> New invoice
            </Link>
          </div>
        </div>

        {/* 4-Column KPI Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Key metrics">
          <DarkCard className="p-5" ringsAt="-right-10 -bottom-10 h-36 w-36">
            <div className="text-xs font-semibold text-soft">Total advances received</div>
            <div className="mt-1.5 text-3xl font-extrabold text-white">
              {offers ? <CountUp value={received} format={inr} /> : '…'}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-lime font-bold">
              <span>{offers?.length ?? 0} offers released</span>
            </div>
          </DarkCard>

          <Card className="p-5 border border-line">
            <div className="text-xs font-semibold text-muted">In review with lender</div>
            <div className="mt-1.5 text-3xl font-extrabold text-ink">{lender.length}</div>
            <div className={`mt-2 text-xs font-semibold ${lender.length ? 'text-warn' : 'text-muted'}`}>
              {lender.length ? `${inr(lender.reduce((s, r) => s + (r.amount ?? 0), 0))} under review` : 'Nothing waiting'}
            </div>
          </Card>

          <Card className="p-5 border border-line">
            <div className="text-xs font-semibold text-muted">Awaiting buyer confirmation</div>
            <div className="mt-1.5 text-3xl font-extrabold text-ink">{buyer.length}</div>
            <div className="mt-2 text-xs font-semibold text-muted">
              {buyer.length ? `${inr(buyer.reduce((s, r) => s + (r.amount ?? 0), 0))} pending OK` : 'All confirmed'}
            </div>
          </Card>

          <Card className="p-5 border border-line">
            <div className="text-xs font-semibold text-muted">Total invoices submitted</div>
            <div className="mt-1.5 text-3xl font-extrabold text-ink">{rows?.length ?? '—'}</div>
            <div className="mt-2 text-xs font-semibold text-ok">
              {rows?.filter(r => r.status === 'offer_released').length ?? 0} financed
            </div>
          </Card>
        </section>

        {/* Recent Invoices Desktop Table */}
        <section className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">Recent invoices</h2>
              <p className="text-xs text-muted">Real-time status as buyers confirm and lenders decide</p>
            </div>
            <Link to="/s/invoices" className="text-xs font-bold text-muted hover:text-ink underline-offset-2 hover:underline">
              View all invoices →
            </Link>
          </div>

          {!rows ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !rows.length ? (
            <Empty icon="scan" title="No invoices yet" action={<Link to="/s/upload" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-lime px-5 text-sm font-bold text-ink">Upload your first invoice<Icon name="next" size={16} /></Link>}>
              Your buyer raises a purchase order, you deliver goods, then upload the invoice here to get up to 85% advance.
            </Empty>
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold text-muted">
                    <th className="pb-3 pl-2">Invoice #</th>
                    <th className="pb-3">Buyer</th>
                    <th className="pb-3">Invoice Date</th>
                    <th className="pb-3 text-right">Amount</th>
                    <th className="pb-3 pl-4">Advance Offer</th>
                    <th className="pb-3">Risk Level</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.slice(0, 8).map((inv) => {
                    const o = offers?.find((x) => x.invoice_id === inv.id)
                    const buyerName = names.get(inv.buyer_id ?? '')?.name ?? 'Buyer not chosen'
                    const to = inv.status === 'extracted' ? `/s/review/${inv.id}` : `/s/invoice/${inv.id}`
                    return (
                      <tr key={inv.id} className="hover:bg-ground/60 transition-colors">
                        <td className="py-3.5 pl-2 font-bold text-ink">
                          <Link to={to} className="hover:underline">{inv.invoice_no ?? 'Draft'}</Link>
                        </td>
                        <td className="py-3.5 text-ink-3">{buyerName}</td>
                        <td className="py-3.5 text-xs text-muted">{day(inv.invoice_date ?? inv.created_at)}</td>
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
                            {inv.status === 'extracted' ? 'Complete review →' : 'View details →'}
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

        {/* Security & Audit Chain Assurance Banner */}
        <div className="flex items-center gap-3 rounded-2xl bg-white border border-line p-4 text-xs text-muted">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ground text-ink">
            <Icon name="shield" size={16} />
          </span>
          <span>
            Every invoice undergoes 21 automated fraud and validation checks. Approved advances are cryptographically sealed in an immutable Merkle audit tree.
          </span>
        </div>
      </Page>
    )
  }

  // MOBILE PHONE INTERFACE
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
