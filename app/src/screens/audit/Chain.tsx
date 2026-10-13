import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { short } from '@shared/canon.ts'
import { call, supabase } from '../../lib/supabase'
import { onChainRoot } from '../../lib/chain'
import type { AuditRow } from '../../lib/data'
import { Icon, Rings } from '../../ui/Icon'
import { Badge, Btn, Card, Empty, ErrorNote, Skeleton } from '../../ui/kit'
import { buzz, Page, soft, Stagger, StaggerItem } from '../../ui/motion'
import { DeskShell } from '../../ui/DeskShell'

type Problem = { kind: string; seq?: number; invoice_id?: string; message: string }
type Batch = { batch_no: number; from_seq: number; to_seq: number; leaf_count: number; merkle_root: string; recomputed_root: string | null; matches_db: boolean; tx_hash: string; contract_address: string; block_number: number }
type Report = { ok: boolean; problems: Problem[]; batches: Batch[]; count: number; head: { seq: number; entry_hash: string } | null }

export function Chain() {
  const [entries, setEntries] = useState<AuditRow[] | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [chain, setChain] = useState<Record<number, { root?: string; block?: number; error?: string }>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('audit_log').select('*').order('seq', { ascending: false }).limit(200)
    if (e) setError('Could not load the audit log.'); else setEntries(data as AuditRow[])
  }, [])
  useEffect(() => {
    load()
    const ch = supabase.channel('audit-' + Math.random().toString(36).slice(2)).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function verify() {
    setBusy(true); setError(null); setChain({}); setReport(null)
    try {
      const [r] = await Promise.all([call<Report>('verify-chain', {}), new Promise((ok) => setTimeout(ok, 900))]) // let the sweep play
      setReport(r); buzz(r.ok ? 15 : [40, 60, 40])
      const out: typeof chain = {}
      for (const b of r.batches) out[b.batch_no] = await onChainRoot(b.tx_hash, b.contract_address)
      setChain(out)
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  const bad = new Set(report?.problems.map((p) => p.seq).filter(Boolean))
  const head = entries?.[0]
  return (
    <DeskShell>
      <Page className="mx-auto max-w-[1200px] space-y-4">
        <div><h1 className="text-2xl font-extrabold">Audit chain</h1><p className="text-[13px] text-muted">Every step is hash-linked to the one before; batch roots are anchored on a blockchain.</p></div>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <section className="relative overflow-hidden rounded-[26px] bg-ink p-5 text-white">
              <Rings className="-right-12 -top-12 h-48 w-48" />
              <div className="relative">
                <div className="text-sm text-soft">Chain head {head ? `· entry #${head.seq}` : ''}</div>
                <code className="mt-1 block break-all font-mono text-sm text-lime">{head?.entry_hash ?? '—'}</code>
                <p className="mt-2 text-xs text-soft">Note this hash down: rewriting any earlier entry changes it.</p>
                <div className="relative mt-4 overflow-hidden rounded-2xl">
                  <Btn className="w-full" onClick={verify} busy={busy} icon="shield">{busy ? 'Re-hashing every entry, record and file…' : 'Verify chain'}</Btn>
                  {busy && <motion.span className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" initial={{ x: '-100%' }} animate={{ x: '300%' }} transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }} />}
                </div>
              </div>
            </section>
            {error && <ErrorNote>{error}</ErrorNote>}
            <AnimatePresence>
              {report && (
                <motion.section key={String(report.ok)} role="status" initial={{ opacity: 0, y: 10 }} animate={report.ok ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }} transition={soft}
                  className={`rounded-[24px] p-5 ${report.ok ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'}`}>
                  <div className="flex items-center gap-3 text-lg font-bold">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full ${report.ok ? 'bg-ok text-white' : 'bg-bad text-white'}`}><Icon name={report.ok ? 'check' : 'x'} size={20} width={3} /></span>
                    {report.ok ? `Intact: ${report.count} entries, every record and file match` : `Tampering found (${report.problems.length})`}
                  </div>
                  {!report.ok && <ul className="mt-3 space-y-1.5 text-sm">{report.problems.map((p, i) => <li key={i} className="flex gap-2"><Icon name="alert" size={16} className="mt-0.5 shrink-0" /><span>{p.message}{p.invoice_id && <> <Link className="font-semibold underline" to={`/l/invoice/${p.invoice_id}`}>open</Link></>}</span></li>)}</ul>}
                </motion.section>
              )}
            </AnimatePresence>
            <Card className="p-5">
              <div className="mb-3 font-bold">Anchored batches</div>
              {!report ? <p className="text-sm text-muted">Verify to recompute each batch root and compare it with the chain.</p>
                : !report.batches.length ? <Empty icon="link" title="No batches anchored yet">Run <code>npm --prefix chain run anchor</code> on the anchor laptop.</Empty> : (
                  <Stagger className="space-y-2">
                    {report.batches.map((b) => {
                      const c = chain[b.batch_no], onChain = c?.root ? c.root === b.merkle_root : null
                      return (
                        <StaggerItem key={b.batch_no} className="rounded-2xl bg-ground p-3.5 text-sm">
                          <div className="flex flex-wrap items-center gap-2"><b>Batch #{b.batch_no}</b><span className="text-muted">#{b.from_seq}–#{b.to_seq} · {b.leaf_count} entries · block {b.block_number}</span></div>
                          <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone={b.matches_db ? 'ok' : 'bad'}>{b.matches_db ? 'log matches root' : 'log changed'}</Badge>{onChain !== null && <Badge tone={onChain ? 'ok' : 'bad'}>{onChain ? 'root matches on-chain' : 'differs from chain'}</Badge>}</div>
                          <code className="mt-1.5 block font-mono text-xs text-muted">root {short(b.merkle_root)}</code>
                          {c?.error && <p className="mt-1 text-xs text-warn">{c.error}</p>}
                        </StaggerItem>
                      )
                    })}
                  </Stagger>
                )}
            </Card>
          </div>
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between"><span className="font-bold">Entries</span><span className="text-xs text-muted">live · latest first</span></div>
            {!entries ? <Skeleton className="h-96" /> : !entries.length ? <Empty title="The log is empty" /> : (
              <ol className="max-h-[70vh] space-y-2 overflow-y-auto pr-1 thin-scroll">
                <AnimatePresence initial={false}>
                  {entries.map((e) => (
                    <motion.li key={e.seq} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={`rounded-2xl px-3 py-2.5 text-[13px] ${bad.has(e.seq) ? 'bg-bad-soft ring-2 ring-bad' : 'bg-ground'}`}>
                      <div className="flex flex-wrap items-center gap-x-2"><b>#{e.seq}</b><span>{e.event_type.replace(/_/g, ' ')}</span><span className="text-xs text-muted">{new Date(e.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        {e.invoice_id && <Link to={`/l/invoice/${e.invoice_id}`} className="ml-auto text-xs font-semibold">invoice →</Link>}</div>
                      <div className="text-muted">{e.payload.summary}</div>
                      <code className="font-mono text-[11px] text-muted">{short(e.entry_hash)} ← {short(e.prev_hash)}</code>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            )}
          </Card>
        </div>
      </Page>
    </DeskShell>
  )
}
