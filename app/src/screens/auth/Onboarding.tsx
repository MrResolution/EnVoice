import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../lib/auth'
import { call } from '../../lib/supabase'
import { parties } from '../../lib/data'
import { Icon, Rings } from '../../ui/Icon'
import { Btn, ErrorNote, Field, RoundBtn } from '../../ui/kit'
import { buzz, soft } from '../../ui/motion'

type Role = 'supplier' | 'buyer'

export function Onboarding() {
  const { session, refresh, signOut } = useAuth()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role>('supplier')
  const [form, setForm] = useState({ business_name: '', gstin: '', bank_account: '', city: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meta = session?.user.user_metadata ?? {}

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await call('onboard', { role, ...form, full_name: meta.full_name ?? meta.name ?? '' })
      buzz(20)
      await parties(true)
      await refresh() // the router sends the new account to its home
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  const option = (r: Role, title: string, text: string, icon: 'up' | 'down') => {
    const on = role === r
    return (
      <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setRole(r)} aria-pressed={on}
        className={`relative overflow-hidden rounded-[26px] p-[18px] text-left transition-colors duration-300 ${on ? 'bg-ink text-white' : 'bg-white'}`}>
        {on && <Rings className="-bottom-12 -right-10 h-36 w-36" />}
        <div className="relative flex items-center justify-between">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full ${on ? 'bg-lime text-ink' : 'bg-ground'}`}><Icon name={icon} size={22} width={2.2} /></span>
          <AnimatePresence>{on && <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-ink-2 px-2.5 py-1 text-xs font-bold text-lime">Selected</motion.span>}</AnimatePresence>
        </div>
        <div className="relative mt-3.5 text-xl font-bold">{title}</div>
        <div className={`relative mt-1 text-sm leading-relaxed ${on ? 'text-soft' : 'text-muted'}`}>{text}</div>
      </motion.button>
    )
  }

  return (
    <div className="flex min-h-dvh justify-center bg-[#e4e8ea] sm:items-center sm:py-6">
      <div className="flex min-h-dvh w-full max-w-[460px] flex-col overflow-hidden bg-ground px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:min-h-[820px] sm:rounded-[40px] sm:shadow-[0_30px_80px_-30px_rgba(18,20,22,0.45)]">
        <div className="flex items-center justify-between">
          {step ? <RoundBtn icon="back" label="Back" onClick={() => setStep(0)} /> : <RoundBtn icon="logout" label="Sign out" onClick={signOut} />}
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 2`}>
            {[0, 1].map((i) => <motion.span key={i} animate={{ width: i === step ? 28 : 12, backgroundColor: i <= step ? '#121416' : '#cdd3d6' }} className="h-1.5 rounded-full" />)}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 0 ? (
            <motion.div key="role" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30, transition: { duration: 0.15 } }} transition={soft} className="flex flex-1 flex-col">
              <p className="mt-6 text-[13px] text-muted">Signed in as {session?.user.email}</p>
              <h1 className="mt-1 text-[30px] font-extrabold leading-tight tracking-[-0.03em]">How will you use Invoseal?</h1>
              <div className="mt-5 grid gap-3">
                {option('supplier', 'I sell goods', 'Upload invoices your buyers pay later. Get up to 85% today.', 'up')}
                {option('buyer', 'I buy goods', 'Raise purchase orders, record deliveries, confirm invoices.', 'down')}
              </div>
              <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-[13px] text-ink-3"><Icon name="info" size={18} />Prototype: no KYC, Aadhaar or PAN needed.</div>
              <Btn type="button" className="mt-auto w-full" onClick={() => setStep(1)}>Continue</Btn>
            </motion.div>
          ) : (
            <motion.form key="biz" onSubmit={submit} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30, transition: { duration: 0.15 } }} transition={soft} className="flex flex-1 flex-col">
              <h1 className="mt-6 text-[30px] font-extrabold leading-tight tracking-[-0.03em]">Your business</h1>
              <p className="mt-1 text-sm text-muted">Used to match invoices and catch self-dealing. Made-up values are fine.</p>
              <div className="mt-4 rounded-[24px] bg-white px-4">
                <Field label="Business name" required minLength={2} value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder={role === 'supplier' ? 'Sunrise Packaging' : 'Metro Mart'} autoFocus />
                <Field label="GSTIN (optional)" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="33AAACS1234F1Z5" maxLength={18} />
                <Field label={role === 'supplier' ? 'Bank account for payouts' : 'Bank account you pay from'} required inputMode="numeric" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="5012 3400 8811" />
                <Field label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Coimbatore" />
              </div>
              <div className="relative mt-3 flex items-center gap-3 overflow-hidden rounded-[22px] bg-ink px-4 py-3.5 text-[13px] leading-relaxed text-soft">
                <Rings className="-right-10 -top-10 h-28 w-28" />
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime text-ink"><Icon name="shield" size={18} /></span>
                <span className="relative">Only the last 4 digits of your account are ever shown. Files stay private.</span>
              </div>
              <div className="mt-auto space-y-3 pt-5">
                {error && <ErrorNote>{error}</ErrorNote>}
                <Btn type="submit" busy={busy} icon="next" className="w-full">Create my account</Btn>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
