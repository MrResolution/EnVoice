import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../lib/auth'
import { BUCKET, call, supabase } from '../../lib/supabase'
import { dHash, shrinkIfLarge } from '../../lib/image'
import { useDesktop } from '../../lib/layout'
import { Icon, Rings } from '../../ui/Icon'
import { ErrorNote, RoundBtn } from '../../ui/kit'
import { buzz, Page, Stagger, StaggerItem } from '../../ui/motion'
import { TopBar } from '../../ui/MobileShell'

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
// The demo samples ship with the build byte-for-byte (same SHA-256 as samples/). Each belongs to one seller.
const SAMPLES = [
  ['S1-clean.png', 'S1 · clean invoice', 'Peacock Retail · ₹2,40,000', 'Ravi Plastics'],
  ['INV-5101.png', 'INV-5101 · 20L Buckets', 'Peacock Retail · ₹1,18,000', 'Ravi Plastics'],
  ['INV-5102.png', 'INV-5102 · Storage Drums', 'Peacock Retail · ₹1,18,000', 'Ravi Plastics'],
  ['INV-5103.png', 'INV-5103 · Pedal Dustbins', 'Peacock Retail · ₹1,18,000', 'Ravi Plastics'],
  ['INV-5104.png', 'INV-5104 · Plastic Crates', 'Peacock Retail · ₹1,41,600', 'Ravi Plastics'],
  ['INV-5105.png', 'INV-5105 · Water Containers', 'Peacock Retail · ₹1,06,200', 'Ravi Plastics'],
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
  const desktop = useDesktop()
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
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

  async function createManual() {
    setError(null)
    try {
      setStep('preparing')
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 1000
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 800, 1000)
        ctx.fillStyle = '#142133'
        ctx.font = 'bold 36px sans-serif'
        ctx.fillText('TAX INVOICE', 60, 90)
        ctx.fillStyle = '#626e80'
        ctx.font = '20px sans-serif'
        ctx.fillText(`Created by ${profile?.party_name ?? 'Supplier'}`, 60, 135)
        ctx.fillText(`Date: ${new Date().toLocaleDateString('en-IN')}`, 60, 170)
        ctx.strokeStyle = '#cdd4de'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(60, 200)
        ctx.lineTo(740, 200)
        ctx.stroke()
        ctx.fillStyle = '#142133'
        ctx.font = '16px monospace'
        ctx.fillText('Digital entry created via Invoseal', 60, 240)
      }
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('Could not generate document.')
      const file = new File([blob], `invoice-${Date.now()}.png`, { type: 'image/png' })
      await send(file)
    } catch (e) {
      setError((e as Error).message)
      setStep('idle')
    }
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) send(f) }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) send(f)
  }

  const busy = step !== 'idle'

  return (
    <Page className="space-y-5">
      <TopBar back={<RoundBtn icon="back" label="Back" to="/s" />} title="Upload invoice" subtitle="PDF, JPEG, PNG or WebP · max 5 MB" />
      <div className={desktop ? 'space-y-6 max-w-4xl' : 'space-y-3 px-[18px]'}>
        <AnimatePresence mode="wait">
          {busy ? (
            <motion.section key="busy" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-10 text-white shadow-xl" aria-live="polite">
              <Rings className="-right-12 -top-12 h-56 w-56" />
              <div className="relative mx-auto h-44 w-36 overflow-hidden rounded-2xl bg-white p-3.5 shadow-md">
                {[60, 85, 70, 90, 55].map((w, i) => <div key={i} className="mb-2.5 h-1.5 rounded bg-line" style={{ width: `${w}%` }} />)}
                <div className="mt-4 h-7 rounded bg-ground" />
                <motion.div className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-lime/60 to-transparent" animate={{ top: ['-10%', '90%', '-10%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
              </div>
              <ol className="relative mt-8 space-y-3 max-w-sm mx-auto">
                {STEPS.map((s, i) => {
                  const at = STEPS.indexOf(step), done = i < at, now = i === at
                  return (
                    <li key={s} className={`flex items-center gap-3 text-sm ${now ? 'font-bold text-white' : done ? 'text-lime font-semibold' : 'text-soft'}`}>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-lime text-ink' : now ? 'bg-ink-3' : 'bg-ink-2'}`}>
                        {done ? <Icon name="check" size={13} width={3} /> : now ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-lime border-t-transparent" /> : null}
                      </span>
                      {STEP_TEXT[s]}
                    </li>
                  )
                })}
              </ol>
            </motion.section>
          ) : desktop ? (
            /* DESKTOP DRAG & DROP ZONE */
            <motion.div key="desk-pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => picker.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                  dragging ? 'border-lime bg-lime/10 scale-[1.01]' : 'border-line bg-white hover:border-ink hover:bg-ground/50'
                }`}>
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ground mb-4 shadow-sm">
                  <Icon name="upload" size={28} />
                </span>
                <span className="text-lg font-bold text-ink">Drag and drop your invoice here, or browse</span>
                <span className="mt-1 text-xs text-muted">Supports PDF, PNG, JPEG or WebP (up to 5 MB)</span>
                <div className="mt-4 flex items-center gap-3">
                  <span className="rounded-xl bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-ink-2 transition">
                    Choose file from laptop
                  </span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); createManual() }}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink hover:bg-ground transition shadow-sm">
                    <Icon name="plus" size={14} /> Enter manually
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-2xl bg-white border border-line px-4 py-3 text-xs text-muted">
                <Icon name="shield" size={16} className="text-ink shrink-0" />
                <span>
                  <b>Private & secure:</b> Only you, the matching buyer, and the lender can access the original invoice. Its cryptographic SHA-256 fingerprint is recorded on the immutable audit chain.
                </span>
              </div>
            </motion.div>
          ) : (
            /* MOBILE SELECTION BUTTONS */
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
              <motion.button whileTap={{ scale: 0.98 }} onClick={createManual} className="flex w-full items-center gap-4 rounded-[28px] border-2 border-dashed border-ink/20 bg-ground/50 p-5 text-left hover:border-ink hover:bg-white transition">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm text-ink"><Icon name="plus" size={26} /></span>
                <span><span className="block text-lg font-bold">Create manually</span><span className="block text-sm text-muted">Type fields or auto-match from Purchase Order</span></span>
              </motion.button>
              <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted"><Icon name="shield" size={16} className="mt-0.5 shrink-0" />Private: only you, the buyer on the invoice and the lender can open it. Its SHA-256 fingerprint goes into the audit chain.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
        <input ref={picker} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden onChange={onPick} />
        {error && <ErrorNote>{error}</ErrorNote>}

        {/* Demo Samples Section */}
        {samples.length > 0 && !busy && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-ink">Test with pre-loaded demo invoices</h2>
              <span className="text-xs text-muted">Click to test instant extraction & checks</span>
            </div>
            <Stagger className={`grid gap-3 ${desktop ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {samples.map(([file, title, sub]) => (
                <StaggerItem key={file}>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => sample(file)}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-white p-3.5 text-left hover:border-ink transition shadow-sm">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ground">
                      <Icon name="doc" size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{title}</span>
                      <span className="block truncate text-xs text-muted">{sub}</span>
                    </span>
                    <Icon name="chevron" size={16} stroke="var(--color-muted)" />
                  </motion.button>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        )}
      </div>
    </Page>
  )
}
