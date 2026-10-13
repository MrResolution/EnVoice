import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { day, inr } from '@shared/normalize.ts'
import { useAuth } from '../../lib/auth'
import { call } from '../../lib/supabase'
import { nextStep, useInvoices, useOffers, useParties, type InvoiceRow } from '../../lib/data'
import { DocumentView } from '../../components/DocumentView'
import { Icon, Rings } from '../../ui/Icon'
import { Badge, Btn, Card, DarkCard, Empty, ErrorNote, Skeleton, toneOf } from '../../ui/kit'
import { CountUp, Page, soft, spring, useToast } from '../../ui/motion'
import { DeskShell } from '../../ui/DeskShell'
import { AuditList, ChecksList, MatchTable, RiskBars, RiskRing, StatusBadge, Steps, useInvoiceDetail } from '../../ui/invoice'

const FILTERS: [string, string, (r: InvoiceRow) => boolean][] = [
  ['review', 'Needs review', (r) => r.status === 'review'],
  ['all', 'All', () => true],
  ['buyer', 'With buyer', (r) => ['checked', 'approved'].includes(r.status)],
  ['released', 'Released', (r) => r.status === 'offer_released'],
  ['rejected', 'Rejected', (r) => r.status === 'rejected'],
]
/** Riskiest first, so the pile a person must look at starts with the worst. */
const rank = (a: InvoiceRow, b: InvoiceRow) => (b.risk_score ?? -1) - (a.risk_score ?? -1) || b.created_at.localeCompare(a.created_at)

export function LenderDashboard() {
  const { profile } = useAuth()
  const { rows } = useInvoices()
  const { rows: offers } = useOffers()
  const names = useParties()
  const nav = useNavigate()
  const [filter, setFilter] = useState('review')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const submitted = useMemo(() => rows?.filter((r) => !['uploaded', 'extracted'].includes(r.status)) ?? null, [rows])
  const count = (k: string) => submitted?.filter(FILTERS.find((f) => f[0] === k)![2]).length ?? 0
  useEffect(() => { if (submitted && !count('review') && filter === 'review') setFilter('all') }, [submitted]) // eslint-disable-line react-hooks/exhaustive-deps
  const nm = (id: string | null) => (id ? names.get(id)?.name ?? '…' : '—')
  const shown = submitted?.filter(FILTERS.find((f) => f[0] === filter)![2])
    .filter((r) => !q || `${r.invoice_no} ${nm(r.supplier_id)} ${nm(r.buyer_id)}`.toLowerCase().includes(q.toLowerCase())).sort(rank) ?? null
  const advanced = (offers ?? []).reduce((s, o) => s + o.advance_amount, 0)
  const avgPct = offers?.length ? Math.round(offers.reduce((s, o) => s + o.advance_pct, 0) / offers.length) : 0
  useEffect(() => { if (!sel && shown?.length && window.matchMedia('(min-width: 1280px)').matches) setSel(shown[0].id) }, [shown, sel])
  const open = (id: string) => (window.matchMedia('(min-width: 1280px)').matches ? setSel(id) : nav(`/l/invoice/${id}`))

  return (
    <DeskShell badge={count('review')}>
      <Page className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <div className="flex-1"><div className="text-xl">Hello, <b>{profile?.full_name?.split(' ')[0]}</b></div><div className="text-[13px] text-muted">Lender · {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div></div>
          <label className="flex h-12 w-full items-center gap-2 rounded-full bg-white px-4 sm:w-80"><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice, seller, buyer" className="flex-1 bg-transparent text-sm outline-none" /></label>
        </header>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-[1.4fr_1fr_1fr_1fr]" aria-label="Key numbers">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative col-span-2 overflow-hidden rounded-[24px] bg-ink text-white xl:col-span-1">
            <div className="flex justify-between rounded-br-[20px] bg-lime px-4 py-2.5 text-[13px] text-ink"><b>Advanced so far</b><span>{offers?.length ?? 0} invoices</span></div>
            <Rings className="-bottom-12 -right-8 h-32 w-32" />
            <div className="relative flex items-end justify-between px-4 pb-4 pt-3"><span className="text-[28px] font-bold"><CountUp value={advanced} format={inr} /></span><span className="text-[13px] font-semibold text-lime">avg {avgPct}%</span></div>
          </motion.div>
          {[
            ['Needs review', count('review'), 'a warning or low credit', 'text-warn'],
            ['With buyers', count('buyer'), 'checks passed, waiting for OK', 'text-muted'],
            ['Blocked by rules', count('rejected'), 'a hard rule failed', 'text-bad'],
          ].map(([l, v, n, c], i) => (
            <motion.div key={l as string} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }} className="rounded-[24px] bg-white p-4">
              <div className="text-[13px] text-muted">{l}</div><div className="mt-1 text-[26px] font-bold"><CountUp value={v as number} format={String} duration={0.6} /></div><div className={`mt-0.5 text-xs font-semibold ${c}`}>{n}</div>
            </motion.div>
          ))}
        </section>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="rounded-[26px] bg-white p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center gap-1">
              <h2 className="mr-auto text-[17px] font-bold">Invoices · ranked by risk</h2>
              {FILTERS.map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className="relative min-h-10 rounded-full px-3.5 text-[13px]">
                  {filter === k && <motion.span layoutId="lend-filter" transition={spring} className="absolute inset-0 rounded-full bg-ink" />}
                  <span className={`relative ${filter === k ? 'font-semibold text-white' : 'text-ink-3'}`}>{label} {count(k)}</span>
                </button>
              ))}
            </div>
            {!shown ? <Skeleton className="h-64" /> : !shown.length ? <Empty title="Nothing here">Invoices appear as soon as a seller submits one.</Empty> : (
              <div className="-mx-1 overflow-x-auto thin-scroll">
                <table className="w-full min-w-[640px] text-sm">
                  <thead><tr className="text-left text-xs text-muted"><th className="px-2 py-2 font-medium">Invoice</th><th className="font-medium">Seller → buyer</th><th className="text-right font-medium">Amount</th><th className="pl-4 font-medium">Risk</th><th className="font-medium">Credit</th><th className="font-medium">Status</th></tr></thead>
                  <motion.tbody initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.03 } } }}>
                    {shown.map((r) => (
                      <motion.tr key={r.id} variants={{ h: { opacity: 0 }, s: { opacity: 1 } }} onClick={() => open(r.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(r.id)}
                        className={`cursor-pointer border-t border-line transition-colors ${sel === r.id ? 'bg-[#f5fbe4]' : 'hover:bg-ground'}`}>
                        <td className="px-2 py-3 font-bold">{r.invoice_no ?? '—'}<div className="text-xs font-normal text-muted">{day(r.created_at)}</div></td>
                        <td className="py-3">{nm(r.supplier_id)} → {nm(r.buyer_id)}</td>
                        <td className="py-3 text-right font-semibold">{inr(r.amount)}</td>
                        <td className="py-3 pl-4"><span className={`font-bold ${r.risk_level === 'HIGH' ? 'text-bad' : r.risk_level === 'MEDIUM' ? 'text-warn' : 'text-ok'}`}>{r.risk_level === 'LOW' ? '▲' : r.risk_level === 'MEDIUM' ? '●' : '▼'} {r.risk_score ?? '—'}</span></td>
                        <td className="py-3">{r.buyer_score ?? '—'}</td>
                        <td className="py-3"><StatusBadge inv={r} /></td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </table>
              </div>
            )}
          </section>
          <AnimatePresence mode="wait">{sel && <SidePanel key={sel} id={sel} />}</AnimatePresence>
        </div>
      </Page>
    </DeskShell>
  )
}

/** The selected invoice beside the table: why, the match, and the decision buttons. */
function SidePanel({ id }: { id: string }) {
  const { profile } = useAuth()
  const { d, reload } = useInvoiceDetail(id)
  if (!d) return <Skeleton className="hidden h-[520px] xl:block" />
  const { inv } = d
  return (
    <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={soft} className="sticky top-6 hidden space-y-3 xl:block">
      <DarkCard className="p-[18px]">
        <div className="flex items-center gap-4">
          {inv.risk_score !== null && inv.risk_level && <RiskRing score={inv.risk_score} level={inv.risk_level} size={92} dark />}
          <div className="min-w-0"><div className="text-[22px] font-bold">{inv.invoice_no}</div><div className="truncate text-[13px] text-soft">{d.supplier} → {d.buyer}</div><div className="mt-1 text-lg font-bold text-lime">{inr(inv.amount)}</div></div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-[#d9dde0]">{inv.risk_summary?.replace(/^Risk \d+\/100 — \w+\. /, '')}</p>
      </DarkCard>
      <Card><div className="mb-3 text-sm font-bold">Risk breakdown</div><RiskBars inv={inv} /></Card>
      {profile?.role === 'lender' && <Decision d={d} onDone={reload} />}
      <Link to={`/l/invoice/${inv.id}`} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold">Open full invoice<Icon name="next" size={16} /></Link>
    </motion.aside>
  )
}

function Decision({ d, onDone }: { d: NonNullable<ReturnType<typeof useInvoiceDetail>['d']>; onDone: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!d) return null
  const { inv } = d
  const advance = inv.advance_pct && inv.amount ? Math.round(inv.amount * inv.advance_pct) / 100 : null
  if (inv.status !== 'review') return <Card className="text-[13px] leading-relaxed"><Badge tone={toneOf(inv.status)}>{inv.decided_by === 'lender' ? 'decided by you' : 'decided by the rules'}</Badge><p className="mt-2">{nextStep(inv)}</p></Card>
  async function act(action: 'approve' | 'reject') {
    setBusy(action); setError(null)
    try { const r = await call<{ message: string }>('invoice-action', { invoice_id: inv.id, action }); toast(r.message); onDone() }
    catch (e) { setError((e as Error).message) }
    setBusy(null)
  }
  return (
    <Card>
      <div className="text-sm font-bold">Your decision</div>
      <p className="mt-1 text-[13px] text-muted">Buyer credit {inv.buyer_score} → {inv.advance_pct}% advance{advance ? ` = ${inr(advance)}` : ''}, released once the buyer confirms.{inv.buyer_status === 'disputed' ? ' The buyer disputed it, so it can only be rejected.' : ''}</p>
      {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn kind="dark" busy={busy === 'reject'} onClick={() => act('reject')}>Reject</Btn>
        <Btn busy={busy === 'approve'} disabled={inv.buyer_status === 'disputed'} onClick={() => act('approve')}>Approve {inv.advance_pct}%</Btn>
      </div>
    </Card>
  )
}

export function LenderInvoice() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { d, reload } = useInvoiceDetail(id)
  const back = profile?.role === 'auditor' ? '/a/invoices' : '/l'
  return (
    <DeskShell>
      <Page className="mx-auto max-w-[1200px] space-y-4">
        <Link to={back} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><Icon name="back" size={18} />Back to the queue</Link>
        {d === false ? <Empty icon="shield" title="Not visible to this account" /> : !d ? <Skeleton className="h-96" /> : (
          <>
            <DarkCard className="p-5 sm:p-6" ringsAt="-right-12 -top-12 h-52 w-52">
              <div className="flex flex-wrap items-center gap-5">
                {d.inv.risk_score !== null && d.inv.risk_level && <RiskRing score={d.inv.risk_score} level={d.inv.risk_level} size={110} dark />}
                <div className="min-w-0 flex-1"><div className="text-[13px] text-soft">{d.supplier} → {d.buyer}</div><div className="text-3xl font-bold">{d.inv.invoice_no}</div><div className="mt-1 text-xl font-bold text-lime">{inr(d.inv.amount)}</div></div>
                <div className="w-full sm:w-auto"><StatusBadge inv={d.inv} /></div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#d9dde0]">{d.inv.risk_summary}</p>
            </DarkCard>
            <Card><Steps inv={d.inv} /></Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><div className="mb-3 font-bold">Risk breakdown</div><RiskBars inv={d.inv} /></Card>
              {profile?.role === 'lender' ? <Decision d={d} onDone={reload} /> : <Card className="text-sm text-muted">Auditors can read everything but change nothing.</Card>}
            </div>
            <Card><div className="mb-1 font-bold">Three-way match</div>{d.po && <p className="mb-2 text-[13px] text-muted">{d.po.po_number}: {d.po.qty} × {d.po.item} at {inr(d.po.unit_price)} = {inr(d.po.total)}{d.po.delivery_receipts[0] ? ` · ${d.po.delivery_receipts[0].grn_number}: ${d.po.delivery_receipts[0].qty_delivered} delivered ${day(d.po.delivery_receipts[0].delivered_on)}` : ' · no delivery recorded'}</p>}<MatchTable checks={d.checks} /></Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><div className="mb-2 font-bold">All {d.checks.length} checks</div><ChecksList checks={d.checks} /></Card>
              <Card><div className="mb-2 font-bold">Document</div><DocumentView path={d.inv.file_path} type={d.inv.file_type} /></Card>
            </div>
            <Card><div className="mb-3 font-bold">Audit trail</div>{d.audit.length ? <AuditList entries={d.audit} /> : <p className="text-sm text-muted">No entries.</p>}</Card>
          </>
        )}
      </Page>
    </DeskShell>
  )
}

export function Portfolio() {
  const { rows: offers } = useOffers()
  const { rows: invoices } = useInvoices()
  const names = useParties()
  const byBuyer = new Map<string, number>()
  for (const o of offers ?? []) {
    const inv = invoices?.find((i) => i.id === o.invoice_id)
    if (inv?.buyer_id) byBuyer.set(inv.buyer_id, (byBuyer.get(inv.buyer_id) ?? 0) + o.advance_amount)
  }
  const total = [...byBuyer.values()].reduce((s, v) => s + v, 0)
  const fees = (offers ?? []).reduce((s, o) => s + o.fee_amount, 0)
  return (
    <DeskShell>
      <Page className="mx-auto max-w-[1200px] space-y-4">
        <h1 className="text-2xl font-extrabold">Portfolio</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          <DarkCard className="p-5"><div className="text-sm text-soft">Outstanding advances</div><div className="mt-1 text-3xl font-bold"><CountUp value={total} format={inr} /></div></DarkCard>
          <Card className="p-5"><div className="text-sm text-muted">Fee income (mock)</div><div className="mt-1 text-3xl font-bold"><CountUp value={fees} format={inr} /></div></Card>
          <Card className="p-5"><div className="text-sm text-muted">Accepted by sellers</div><div className="mt-1 text-3xl font-bold">{offers?.filter((o) => o.status === 'accepted').length ?? 0} / {offers?.length ?? 0}</div></Card>
        </div>
        <Card className="p-5">
          <div className="font-bold">Exposure by buyer</div>
          <p className="text-[13px] text-muted">Who has to pay back what we advanced. One buyer holding most of it is a concentration risk.</p>
          {!byBuyer.size ? <p className="mt-4 text-sm text-muted">No advances yet.</p> : (
            <div className="mt-4 space-y-3">
              {[...byBuyer.entries()].sort((a, b) => b[1] - a[1]).map(([id, v], i) => (
                <div key={id}>
                  <div className="flex justify-between text-sm"><span className="font-semibold">{names.get(id)?.name}</span><span>{inr(v)} · {Math.round((v / total) * 100)}%</span></div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ground"><motion.div className={`h-full rounded-full ${i ? 'bg-ink' : 'bg-lime'}`} initial={{ width: 0 }} animate={{ width: `${(v / total) * 100}%` }} transition={{ ...soft, delay: i * 0.08 }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Page>
    </DeskShell>
  )
}
