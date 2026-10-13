// Invoice pieces shared by the seller, buyer and lender screens. Every number carries its reason.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { day, inr, ref } from '@shared/normalize.ts'
import { short } from '@shared/canon.ts'
import { supabase } from '../lib/supabase'
import { parties, stage, STATUS_LABEL, toInvoice, type AuditRow, type CheckRow, type InvoiceRow, type OfferRow } from '../lib/data'
import { Icon } from './Icon'
import { soft, Stagger, StaggerItem } from './motion'
import { Avatar, Badge, cx, toneOf } from './kit'

export type Po = { po_number: string; item: string; qty: number; unit_price: number; total: number; po_date: string; delivery_receipts: { grn_number: string; qty_delivered: number; delivered_on: string }[] }
export type Detail = { inv: InvoiceRow; checks: CheckRow[]; offer: OfferRow | null; po: Po | null; audit: AuditRow[]; supplier: string; buyer: string }

/** Everything one invoice screen needs, kept live with Realtime. null = loading, false = not visible to this account. */
export function useInvoiceDetail(id: string | undefined) {
  const [d, setD] = useState<Detail | null | false>(null)
  const load = useCallback(async () => {
    if (!id) return
    const { data } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle()
    if (!data) { setD(false); return }
    const inv = toInvoice(data)
    const [c, o, a, p, names] = await Promise.all([
      supabase.from('invoice_checks').select('*').eq('invoice_id', id).order('position'),
      supabase.from('financing_offers').select('*').eq('invoice_id', id).maybeSingle(),
      supabase.from('audit_log').select('*').eq('invoice_id', id).order('seq'),
      inv.buyer_id ? supabase.from('purchase_orders').select('po_number, item, qty, unit_price, total, po_date, delivery_receipts(grn_number, qty_delivered, delivered_on)')
        .eq('buyer_id', inv.buyer_id).eq('supplier_id', inv.supplier_id) : Promise.resolve({ data: [] }),
      parties(),
    ])
    const po = ((p.data ?? []) as Po[]).find((x) => ref(x.po_number) === ref(inv.po_number)) ?? null
    setD({
      inv, checks: (c.data ?? []) as CheckRow[], audit: (a.data ?? []) as AuditRow[],
      offer: o.data ? ({ ...o.data, advance_amount: Number(o.data.advance_amount), fee_amount: Number(o.data.fee_amount) } as OfferRow) : null,
      po: po && { ...po, qty: Number(po.qty), unit_price: Number(po.unit_price), total: Number(po.total), delivery_receipts: po.delivery_receipts.map((r) => ({ ...r, qty_delivered: Number(r.qty_delivered) })) },
      supplier: names.get(inv.supplier_id)?.name ?? '—', buyer: inv.buyer_id ? names.get(inv.buyer_id)?.name ?? '—' : '—',
    })
  }, [id])
  useEffect(() => {
    load()
    const ch = supabase.channel('inv-' + id + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financing_offers', filter: `invoice_id=eq.${id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])
  return { d, reload: load }
}

const LEVEL_COLOR = { LOW: 'var(--color-lime)', MEDIUM: '#f4c76b', HIGH: '#f87171' } as const

/** Circular gauge that fills to the risk score. */
export function RiskRing({ score, level, size = 120, dark }: { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH'; size?: number; dark?: boolean }) {
  const r = 44, c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Risk ${score} out of 100, ${level}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={dark ? 'var(--color-ink-2)' : 'var(--color-line)'} strokeWidth="9" />
        <motion.circle cx="50" cy="50" r={r} fill="none" stroke={LEVEL_COLOR[level]} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.max(score, 2) / 100) }} transition={{ ...soft, delay: 0.15 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cx('text-3xl font-extrabold leading-none', dark && 'text-white')}>{score}</span>
        <span className={cx('mt-1 text-[11px] font-bold tracking-wide', dark ? 'text-soft' : 'text-muted')}>{level} RISK</span>
      </div>
    </div>
  )
}

/** One bar per check group: weight × (pass 0, warning ½, fail 1). */
export function RiskBars({ inv, dark }: { inv: InvoiceRow; dark?: boolean }) {
  return (
    <div className="space-y-3">
      {inv.risk_breakdown?.map((b, i) => (
        <div key={b.category}>
          <div className="flex justify-between gap-2 text-[13px]">
            <span className={dark ? 'text-white' : ''}>{b.label} <span className={dark ? 'text-soft' : 'text-muted'}>· weight {b.weight}</span></span>
            <span className={cx('font-semibold', b.status === 'fail' ? 'text-bad' : b.status === 'warn' ? 'text-warn' : dark ? 'text-lime' : 'text-ok')}>{b.points ? `+${b.points}` : 'pass'}</span>
          </div>
          <div className={cx('mt-1.5 h-2 overflow-hidden rounded-full', dark ? 'bg-ink-2' : 'bg-ground')}>
            <motion.div className={cx('h-full rounded-full', b.status === 'fail' ? 'bg-bad' : b.status === 'warn' ? 'bg-[#f4c76b]' : dark ? 'bg-lime' : 'bg-ink')}
              initial={{ width: 0 }} animate={{ width: b.status === 'pass' ? '100%' : `${(b.points / b.weight) * 100}%` }} transition={{ ...soft, delay: 0.1 + i * 0.06 }} />
          </div>
          {b.reasons[0] && <p className={cx('mt-1 text-xs', dark ? 'text-soft' : 'text-muted')}>{b.reasons[0]}</p>}
        </div>
      ))}
    </div>
  )
}

/** Invoice vs purchase order vs delivery receipt, row by row. */
export function MatchTable({ checks }: { checks: CheckRow[] }) {
  const rows = checks.filter((c) => c.category === 'three_way')
  if (!rows.length) return null
  return (
    <div className="-mx-1 overflow-x-auto thin-scroll">
      <table className="w-full min-w-[30rem] text-[13px]">
        <thead><tr className="text-left text-xs text-muted"><th className="px-1 py-2 font-medium">Check</th><th className="font-medium">Invoice</th><th className="font-medium">PO</th><th className="font-medium">Delivery</th><th /></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-line align-top">
              <td className="px-1 py-2.5 font-semibold">{c.name}</td>
              <td className="py-2.5">{c.detail?.invoice ?? ''}</td><td className="py-2.5">{c.detail?.po ?? ''}</td><td className="py-2.5">{c.detail?.receipt ?? ''}</td>
              <td className="py-2.5 text-right"><Dot status={c.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Dot({ status = 'pass' }: { status?: 'pass' | 'warn' | 'fail' | string }) {
  const s = status === 'warn' ? 'warn' : status === 'fail' ? 'fail' : 'pass'
  return (
    <span aria-label={s} className={cx('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full', s === 'pass' ? 'bg-ok-soft text-ok' : s === 'warn' ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad')}>
      <Icon name={s === 'pass' ? 'check' : s === 'warn' ? 'alert' : 'x'} size={11} width={3} />
    </span>
  )
}

const GROUPS: [string, string][] = [['three_way', 'Three-way match'], ['duplicates', 'Duplicates'], ['vendor_bank', 'Vendor & bank'], ['integrity', 'Document'], ['behaviour', 'Behaviour']]
/** Every check with its reason; problems first so nobody scrolls to find them. Appears one by one. */
export function ChecksList({ checks }: { checks: CheckRow[] }) {
  const order = { fail: 0, warn: 1, pass: 2 }
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status] || a.position - b.position)
  return (
    <Stagger as="ul" className="space-y-1" gap={0.03}>
      {sorted.map((c) => (
        <StaggerItem as="li" key={c.id} className="flex gap-3 rounded-xl py-1.5 text-[13px] leading-snug">
          <Dot status={c.status} />
          <span><span className="font-semibold">{c.name}</span> <span className="text-muted">· {GROUPS.find((g) => g[0] === c.category)?.[1]}</span><br />{c.reason}</span>
        </StaggerItem>
      ))}
    </Stagger>
  )
}

const STEP_NAMES = ['Uploaded', 'Checked', 'Buyer OK', 'Offer']
/** The road to cash as four pills; the current one is dark. */
export function Steps({ inv }: { inv: InvoiceRow }) {
  const at = stage(inv)
  if (at < 0) return <div className="flex items-center gap-2 rounded-2xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad"><Icon name="x" size={16} width={2.6} />Stopped: a hard rule failed</div>
  return (
    <div className="flex items-center justify-between gap-1" aria-label={`Step ${at + 1} of 4: ${STEP_NAMES[at]}`}>
      {STEP_NAMES.map((s, i) => (
        <span key={s} className="relative px-3 py-2 text-[13px]">
          {i === at && <motion.span layoutId={`step-${inv.id}`} className="absolute inset-0 rounded-full bg-ink" transition={soft} />}
          <span className={cx('relative', i === at ? 'font-semibold text-white' : i < at ? 'font-medium text-ink' : 'text-muted')}>{i < at && '✓ '}{s}</span>
        </span>
      ))}
    </div>
  )
}

/** Compact list row for an invoice. */
export function InvoiceRowCard({ inv, name, to, money, upi_id }: { inv: InvoiceRow; name: string; to: string; money?: { value: string; note: string; tone?: 'ok' | 'warn' | 'bad' | 'muted' }; upi_id?: string }) {
  const tone = money?.tone ?? (toneOf(inv.status) === 'neutral' ? 'muted' : toneOf(inv.status))
  return (
    <Link to={to} className="flex items-center gap-3 rounded-[22px] bg-white p-3.5 transition-transform active:scale-[0.98]">
      <Avatar name={name} dark={inv.status === 'offer_released'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{inv.invoice_no ?? 'Draft invoice'}</span>
        <span className="block truncate text-xs text-muted">{name}{upi_id ? ` (${upi_id})` : ''} · {day(inv.invoice_date ?? inv.created_at)}</span>
      </span>
      <span className="text-right">
        <span className="block font-bold">{money?.value ?? inr(inv.amount)}</span>
        <span className={cx('block text-xs font-semibold', tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-muted')}>{money?.note ?? STATUS_LABEL[inv.status]}</span>
      </span>
    </Link>
  )
}

export function AuditList({ entries }: { entries: AuditRow[] }) {
  return (
    <ol className="relative space-y-3 border-l-2 border-line pl-4">
      {entries.map((e) => (
        <li key={e.seq} className="relative">
          <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-ink" />
          <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]"><span className="font-bold">#{e.seq}</span><span>{e.event_type.replace(/_/g, ' ')}</span><span className="text-xs text-muted">{new Date(e.ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
          <div className="text-xs text-muted">{e.payload.summary}</div>
          <code className="font-mono text-[11px] text-muted" title={e.entry_hash}>{short(e.entry_hash)} ← {short(e.prev_hash)}</code>
        </li>
      ))}
    </ol>
  )
}

export function StatusBadge({ inv }: { inv: InvoiceRow }) {
  return <Badge tone={toneOf(inv.status)}>{STATUS_LABEL[inv.status] ?? inv.status}</Badge>
}
