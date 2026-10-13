import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../lib/auth'
import { BUCKET, call, supabase } from '../../lib/supabase'
import { dHash, shrinkIfLarge } from '../../lib/image'
import { Icon, Rings } from '../../ui/Icon'
import { ErrorNote, RoundBtn } from '../../ui/kit'
import { buzz, Page, Stagger, StaggerItem } from '../../ui/motion'
import { TopBar } from '../../ui/MobileShell'

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
// The demo samples ship with the build byte-for-byte (same SHA-256 as samples/). Each belongs to one seller.
const SAMPLES = [
  ['S1-clean.png', 'S1 · clean invoice', 'Peacock Retail · ₹2,40,000', 'Ravi Plastics'],
  ['S2-duplicate.png', 'S2 · exact copy of S1', 'should be blocked', 'Ravi Plastics'],
  ['S3-mismatch.png', 'S3 · 100 billed, 80 delivered', 'Banyan Stores · ₹59,000', 'Ravi Plastics'],
  ['S5-tamper-target.png', 'S5 · clean invoice', 'Banyan Stores · ₹88,500', 'Ravi Plastics'],
  ['S6-edited-copy.png', 'S6 · S1 with edits', 'number, total and bank changed', 'Ravi Plastics'],
  ['S4-self-dealing.png', 'S4 · to Kaveri Retail', 'shares a bank account', 'Kaveri Traders'],
] as const

type Step = 'idle' | 'preparing' | 'uploading' | 'reading'
const STEPS: Step[] = ['preparing', 'uploading', 'reading']
const STEP_TEXT: Record<Step, string> = { idle: '', preparing: 'Fingerprinting the file', uploading: 'Uploading privately', reading: 'AI is reading the fields' }

export function Upload() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const samples = SAMPLES.filter((x) => x[3] === profile?.party_name)

  async function send(original: File) {
    setError(null)
    try {
      if (!EXT[original.type]) throw new Error('Only PDF, JPEG, PNG or WebP files are accepted.')
      setStep('preparing')
      const file = await shrinkIfLarge(original)
      if (file.size > 5 * 1024 * 1024) throw new Error('The file is larger than 5 MB.')
      const image_hash = await dHash(file)
      setStep('uploading')
      const path = `${profile!.party_id}/${crypto.randomUUID()}.${EXT[file.type]}`
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
      if (up.error) throw new Error('Upload failed. Check your connection and try again.')
      setStep('reading')
      const res = await call<{ invoice_id: string; note: string | null }>('extract-invoice', { path, image_hash })
      buzz()
      nav(`/s/review/${res.invoice_id}`, { state: { note: res.note } })
    } catch (e) { setError((e as Error).message); setStep('idle') }
  }
  async function sample(name: string) {
    const res = await fetch(`./samples/${name}`)
    if (!res.ok) return setError('Sample files are not in this build.')
    send(new File([await res.blob()], name, { type: 'image/png' }))
  }
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) send(f) }
  const busy = step !== 'idle'

  return (
    <Page>
      <TopBar back={<RoundBtn icon="back" label="Back" to="/s" />} title="New invoice" subtitle="photo or PDF, max 5 MB" />
      <div className="space-y-3 px-[18px]">
        <AnimatePresence mode="wait">
          {busy ? (
            <motion.section key="busy" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="relative overflow-hidden rounded-[28px] bg-ink px-5 py-7 text-white" aria-live="polite">
              <Rings className="-right-12 -top-12 h-44 w-44" />
              <div className="relative mx-auto h-40 w-32 overflow-hidden rounded-2xl bg-white p-3">
                {[60, 85, 70, 90, 55].map((w, i) => <div key={i} className="mb-2 h-1.5 rounded bg-line" style={{ width: `${w}%` }} />)}
                <div className="mt-3 h-6 rounded bg-ground" />
                <motion.div className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-lime/60 to-transparent" animate={{ top: ['-10%', '90%', '-10%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
              </div>
              <ol className="relative mt-6 space-y-2.5">
                {STEPS.map((s, i) => {
                  const at = STEPS.indexOf(step), done = i < at, now = i === at
                  return (
                    <li key={s} className={`flex items-center gap-3 text-sm ${now ? 'font-semibold text-white' : done ? 'text-lime' : 'text-soft'}`}>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-lime text-ink' : now ? 'bg-ink-3' : 'bg-ink-2'}`}>
                        {done ? <Icon name="check" size={13} width={3} /> : now ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-lime border-t-transparent" /> : null}
                      </span>{STEP_TEXT[s]}
                    </li>
                  )
                })}
              </ol>
            </motion.section>
          ) : (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => camera.current?.click()}
                className={`relative flex w-full items-center gap-4 overflow-hidden rounded-[28px] bg-ink p-5 text-left text-white ${params.get('camera') ? 'ring-4 ring-lime/50' : ''}`}>
                <Rings className="-right-10 -bottom-14 h-40 w-40" />
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-lime text-ink"><Icon name="camera" size={26} /></span>
                <span className="relative"><span className="block text-lg font-bold">Take a photo</span><span className="block text-sm text-soft">Whole invoice, flat, good light</span></span>
              </motion.button>
              <motion.button whileTap={{ scale: 0.98 }} onClick={() => picker.current?.click()} className="flex w-full items-center gap-4 rounded-[28px] bg-white p-5 text-left">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ground"><Icon name="file" size={26} /></span>
                <span><span className="block text-lg font-bold">Choose a file</span><span className="block text-sm text-muted">PDF, JPEG, PNG or WebP</span></span>
              </motion.button>
              <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted"><Icon name="shield" size={16} className="mt-0.5 shrink-0" />Private: only you, the buyer on the invoice and the lender can open it. Its SHA-256 fingerprint goes into the audit chain.</p>
            </motion.div>
          )}
        </AnimatePresence>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
        <input ref={picker} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden onChange={onPick} />
        {error && <ErrorNote>{error}</ErrorNote>}

        {samples.length > 0 && !busy && (
          <>
            <h2 className="pt-2 text-[17px] font-bold">Demo invoices</h2>
            <Stagger className="space-y-2">
              {samples.map(([file, title, sub]) => (
                <StaggerItem key={file}>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => sample(file)} className="flex w-full items-center gap-3 rounded-[20px] bg-white p-3.5 text-left">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-ground"><Icon name="doc" size={20} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{title}</span><span className="block truncate text-xs text-muted">{sub}</span></span>
                    <Icon name="chevron" size={18} stroke="var(--color-muted)" />
                  </motion.button>
                </StaggerItem>
              ))}
            </Stagger>
          </>
        )}
      </div>
    </Page>
  )
}
