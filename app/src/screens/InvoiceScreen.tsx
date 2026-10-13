// One invoice on the phone, for the seller (track, accept the advance) and the buyer (confirm or dispute).
import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { day, inr, mask, qty } from '@shared/normalize.ts'
import { useAuth } from '../lib/auth'
import { call } from '../lib/supabase'
import { nextStep } from '../lib/data'
import { DocumentView } from '../components/DocumentView'
import { Icon } from '../ui/Icon'
import { Badge, Btn, Card, DarkCard, Empty, ErrorNote, RoundBtn, Skeleton } from '../ui/kit'
import { buzz, CountUp, Page, Sheet, soft, spring, useToast } from '../ui/motion'
import { TopBar } from '../ui/MobileShell'
import { ChecksList, Dot, MatchTable, RiskBars, RiskRing, Steps, useInvoiceDetail, type Detail } from '../ui/invoice'

export function InvoiceScreen() {
  const { id } = useParams()
  const { profile } = useAuth()
  const fresh = Boolean((useLocation().state as { fresh?: boolean } | null)?.fresh)
  const { d, reload } = useInvoiceDetail(id)
  const [checking, setChecking] = useState(fresh)
  const role = profile?.role === 'buyer' ? 'buyer' : 'supplier'
  const home = role === 'buyer' ? '/b/invoices' : '/s/invoices'

  useEffect(() => { if (fresh) { const t = setTimeout(() => setChecking(false), 2300); return () => clearTimeout(t) } }, [fresh])

  if (d === false) return <Page><TopBar back={<RoundBtn icon="back" label="Back" to={home} />} title="Invoice" /><div className="px-[18px]"><Empty icon="shield" title="Not visible to this account">Either it doesn't exist or your role can't see it. Access denied is a feature.</Empty></div></Page>
  if (!d) return <Page><TopBar back={<RoundBtn icon="back" label="Back" to={home} />} title="Invoice" /><div className="space-y-3 px-[18px]"><Skeleton className="h-28" /><Skeleton className="h-12" /><Skeleton className="h-64" /></div></Page>

  const { inv, offer } = d
  return (
    <Page>
      <TopBar back={<RoundBtn icon="back" label="Back" to={home} />} title={inv.invoice_no ?? 'Invoice'} subtitle={role === 'buyer' ? d.supplier : d.buyer} />
      <AnimatePresence mode="wait">
        {checking ? <CheckingRun key="run" d={d} /> : (
          <motion.div key="body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 px-[18px]">
            <Hero d={d} role={role} />
            <Steps inv={inv} />
            {inv.risk_score !== null && inv.risk_level && (
              <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.05 }}>
                <div className="flex items-center gap-4">
                  <RiskRing score={inv.risk_score} level={inv.risk_level} size={104} />
                  <div className="min-w-0 text-[13px] leading-relaxed">
                    <div className="mb-1 text-[15px] font-bold">{inv.status === 'rejected' ? 'Why it stopped' : inv.risk_level === 'LOW' ? 'Why you can trust it' : 'What a person will look at'}</div>
                    {inv.risk_summary?.replace(/^Risk \d+\/100 — \w+\. /, '')}
                  </div>
                </div>
                <div className="mt-4"><RiskBars inv={inv} /></div>
              </Card>
            )}
            <Tiles d={d} />
            {d.checks.some((c) => c.category === 'three_way') && <Card><div className="mb-1 text-[15px] font-bold">Invoice vs PO vs delivery</div><MatchTable checks={d.checks} /></Card>}
            {d.checks.length > 0 && <AllChecks d={d} />}
            <DocCard d={d} />
            <div className="h-2" />
            {role === 'supplier' && offer?.status === 'released' && <AcceptBar d={d} onDone={reload} />}
            {role === 'buyer' && <BuyerBar d={d} onDone={reload} />}
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}

/** The moment after submit: the checks tick through one by one, then the result appears. */
function CheckingRun({ d }: { d: Detail }) {
  const names = d.checks.length ? d.checks : Array.from({ length: 21 }, (_, i) => ({ id: String(i), name: 'Check', status: 'pass' as const }))
  return (
    <motion.section exit={{ opacity: 0, scale: 0.98 }} className="mx-[18px] overflow-hidden rounded-[28px] bg-ink p-5 text-white" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        <div><div className="text-lg font-bold">Running {names.length} checks</div><div className="text-xs text-soft">PO, delivery, duplicates, bank, document, behaviour</div></div>
      </div>
      <motion.ul className="mt-4 grid grid-cols-1 gap-1.5" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.08 } } }}>
        {names.slice(0, 21).map((c) => (
          <motion.li key={c.id} variants={{ h: { opacity: 0, x: -8 }, s: { opacity: 1, x: 0 } }} className="flex items-center gap-2.5 text-[13px]">
            <Dot status={c.status} /><span className="text-soft">{c.name}</span>
          </motion.li>
        ))}
      </motion.ul>
    </motion.section>
  )
}

function Hero({ d, role }: { d: Detail; role: 'supplier' | 'buyer' }) {
  const { inv, offer } = d
  if (offer && role === 'supplier') {
    return (
      <DarkCard className="px-[18px] py-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-[28px] font-bold"><CountUp value={offer.advance_amount} format={inr} /></div><div className="text-[13px] text-soft">{offer.status === 'accepted' ? `Accepted ${day(offer.accepted_at)} · mock payout` : 'Advance offered today'}</div></div>
          <span className="rounded-full bg-ink-2 px-3 py-2 text-[13px] font-bold text-lime">{offer.advance_pct}% of {inr(inv.amount)}</span>
        </div>
      </DarkCard>
    )
  }
  return (
    <DarkCard className="px-[18px] py-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between gap-3">
        <div><div className="text-[28px] font-bold">{inr(inv.amount)}</div><div className="text-[13px] text-soft">incl. GST {inr(inv.tax_amount)} · due {day(inv.due_date)}</div></div>
        <span className={`rounded-full bg-ink-2 px-3 py-2 text-[13px] font-bold ${inv.status === 'rejected' ? 'text-[#f87171]' : 'text-lime'}`}>
          {inv.status === 'rejected' ? 'Rejected' : `${d.checks.filter((c) => c.status === 'pass').length}/${d.checks.length} ✓`}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-soft">{role === 'buyer' && inv.buyer_status === 'pending' && inv.status !== 'rejected' ? `Confirm only if you received these goods for this amount. Your OK releases ${d.supplier}'s advance.` : nextStep(inv)}</p>
    </DarkCard>
  )
}

function Tiles({ d }: { d: Detail }) {
  const { inv, offer } = d
  const tile = (label: string, value: string, note: string, tone?: string) => (
    <Card className="p-3.5"><div className="text-xs text-muted">{label}</div><div className="mt-0.5 text-lg font-bold">{value}</div><div className={`mt-0.5 text-xs ${tone ?? 'text-muted'}`}>{note}</div></Card>
  )
  const credit = inv.buyer_score_parts
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {offer ? tile('Fee (mock)', inr(offer.fee_amount), '1.5% per 30 days') : tile('Pay into', inv.bank_account ? `A/c ${mask(inv.bank_account)}` : '—', d.checks.find((c) => c.name === 'Bank account')?.status === 'warn' ? 'differs from approved' : 'approved account', d.checks.find((c) => c.name === 'Bank account')?.status === 'warn' ? 'font-semibold text-warn' : 'font-semibold text-ok')}
      {inv.buyer_score !== null ? tile('Buyer credit', `${inv.buyer_score} / 100`, credit?.newBuyer ? 'new buyer, capped at 60' : `pays on time ${Math.round((credit?.payment ?? 0) * 2)}%`) : tile('Items', `${qty(inv.line_items.reduce((s, l) => s + l.qty, 0))} units`, inv.line_items[0]?.description ?? '')}
    </div>
  )
}

function AllChecks({ d }: { d: Detail }) {
  const [open, setOpen] = useState(false)
  const problems = d.checks.filter((c) => c.status !== 'pass')
  return (
    <Card>
      <div className="flex items-center justify-between"><span className="text-[15px] font-bold">{problems.length ? `${problems.length} to look at` : `All ${d.checks.length} checks passed`}</span>
        <button onClick={() => setOpen(!open)} className="min-h-11 rounded-xl px-2 text-sm font-semibold" aria-expanded={open}>{open ? 'Hide' : `See all ${d.checks.length}`}</button></div>
      <ChecksList checks={open ? d.checks : problems} />
    </Card>
  )
}

function DocCard({ d }: { d: Detail }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <motion.button whileTap={{ scale: 0.98 }} onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-[22px] bg-white p-3.5 text-left">
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-ground"><Icon name="file" /></span>
        <span className="flex-1"><span className="block text-[15px] font-bold">Original document</span><span className="block text-xs text-muted">private · opens with a 60-second link</span></span>
        <Icon name="chevron" size={18} stroke="var(--color-muted)" />
      </motion.button>
      <Sheet open={open} onClose={() => setOpen(false)} title={d.inv.invoice_no ?? 'Document'}>
        <div className="max-h-[70vh] overflow-y-auto thin-scroll"><DocumentView path={d.inv.file_path} type={d.inv.file_type} /></div>
      </Sheet>
    </>
  )
}

/** Sticky action area at the bottom of the screen, above the tab bar. */
function ActionBar({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-[96px] z-20 -mx-[18px] bg-gradient-to-t from-ground via-ground to-transparent px-[18px] pb-2 pt-4">{children}</div>
}

function AcceptBar({ d, onDone }: { d: Detail; onDone: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  async function accept() {
    setBusy(true)
    try { await call('invoice-action', { invoice_id: d.inv.id, action: 'accept' }); buzz(30); setDone(true); onDone() }
    catch (e) { toast((e as Error).message, 'bad') }
    setBusy(false)
  }
  return (
    <>
      <ActionBar><Btn busy={busy} onClick={accept} icon="down" className="w-full">Accept {inr(d.offer!.advance_amount)}</Btn></ActionBar>
      <AnimatePresence>{done && <Celebrate amount={d.offer!.advance_amount} onClose={() => setDone(false)} />}</AnimatePresence>
    </>
  )
}

function Celebrate({ amount, onClose }: { amount: number; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-8 text-center text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span key={i} className="absolute h-2.5 w-2.5 rounded-full" style={{ background: i % 3 ? 'var(--color-lime)' : '#fff' }}
          initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos((i / 14) * Math.PI * 2) * 150, y: Math.sin((i / 14) * Math.PI * 2) * 150 - 60, opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }} />
      ))}
      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.1 }} className="flex h-24 w-24 items-center justify-center rounded-full bg-lime text-ink"><Icon name="check" size={44} width={3} /></motion.span>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 text-[34px] font-bold">{inr(amount)}</motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-2 text-soft">is on its way to your account. Mock payout: no real money moves in this prototype.</motion.p>
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-8 min-h-12 rounded-2xl bg-white px-6 font-bold text-ink">Done</motion.button>
    </motion.div>
  )
}

function BuyerBar({ d, onDone }: { d: Detail; onDone: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [dispute, setDispute] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { inv } = d
  if (inv.buyer_status !== 'pending' || ['rejected', 'offer_released'].includes(inv.status)) {
    return inv.buyer_status === 'pending' ? null : (
      <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm"><Badge tone={inv.buyer_status === 'confirmed' ? 'ok' : 'warn'}>{inv.buyer_status}</Badge>{inv.buyer_note ?? (inv.buyer_status === 'confirmed' ? 'You confirmed the goods and the amount.' : '')}</div>
    )
  }
  async function act(action: 'confirm' | 'dispute') {
    setBusy(action); setError(null)
    try {
      const r = await call<{ message: string }>('invoice-action', { invoice_id: inv.id, action, note })
      buzz(25); toast(r.message); setDispute(false); onDone()
    } catch (e) { setError((e as Error).message) }
    setBusy(null)
  }
  return (
    <>
      <ActionBar>
        <div className="grid grid-cols-2 gap-2.5">
          <Btn kind="dark" onClick={() => setDispute(true)}>Dispute</Btn>
          <Btn busy={busy === 'confirm'} onClick={() => act('confirm')} icon="check">Confirm</Btn>
        </div>
        {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
      </ActionBar>
      <Sheet open={dispute} onClose={() => setDispute(false)} title="What's wrong with this invoice?">
        <div className="mb-3 flex flex-wrap gap-2">
          {['Fewer goods arrived', 'Price is not what we agreed', 'Goods were damaged', 'We never ordered this'].map((r) => (
            <button key={r} onClick={() => setNote(r)} className={`min-h-11 rounded-full px-4 text-sm ${note === r ? 'bg-ink text-white' : 'bg-ground'}`}>{r}</button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} placeholder="Add details for the lender" className="w-full rounded-2xl bg-ground p-3 outline-none" />
        {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
        <Btn kind="dark" className="mt-3 w-full" busy={busy === 'dispute'} disabled={!note.trim()} onClick={() => act('dispute')}>Send dispute</Btn>
      </Sheet>
    </>
  )
}
