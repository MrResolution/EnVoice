import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../lib/auth'
import { call } from '../../lib/supabase'
import { parties } from '../../lib/data'
import { Icon, Rings } from '../../ui/Icon'
import { Btn, ErrorNote, Field, LogoMark, RoundBtn } from '../../ui/kit'
import { buzz, soft } from '../../ui/motion'

type Role = 'supplier' | 'buyer' | 'lender'

export function Onboarding() {
  const { session, refresh, signOut } = useAuth()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role>('supplier')
  const [form, setForm] = useState({ business_name: '', gstin: '', bank_account: '', city: '' })
  const [person, setPerson] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meta = session?.user.user_metadata ?? {}

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await call('onboard', { role, ...form, full_name: person || meta.full_name || meta.name || '' })
      buzz(20)
      await parties(true)
      await refresh() // the router sends the new account to its home
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  const option = (r: Role, title: string, text: string, icon: 'up' | 'down' | 'chart') => {
    const on = role === r
    return (
      <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setRole(r)} aria-pressed={on}
        className={`relative overflow-hidden rounded-[26px] p-5 text-left transition-all border ${on ? 'bg-ink text-white border-ink shadow-lg' : 'bg-white border-line hover:border-ink-3'}`}>
        {on && <Rings className="-bottom-12 -right-10 h-36 w-36" />}
        <div className="relative flex items-center justify-between">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${on ? 'bg-lime text-ink' : 'bg-ground'}`}>
            <Icon name={icon} size={22} width={2.2} />
          </span>
          <AnimatePresence>
            {on && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-full bg-ink-2 px-2.5 py-1 text-xs font-bold text-lime">
                Selected
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="relative mt-4 text-xl font-bold">{title}</div>
        <div className={`relative mt-1 text-xs leading-relaxed ${on ? 'text-soft' : 'text-muted'}`}>{text}</div>
      </motion.button>
    )
  }

  return (
    <div className="min-h-dvh bg-ground flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="w-full max-w-4xl bg-white rounded-[32px] p-6 sm:p-10 shadow-[0_20px_60px_-20px_rgba(18,20,22,0.1)] border border-line flex flex-col">
        {/* Top bar with logo and steps */}
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-3">
            {step ? <RoundBtn icon="back" label="Back" onClick={() => setStep(0)} /> : <RoundBtn icon="logout" label="Sign out" onClick={signOut} />}
            <div className="flex items-center gap-2">
              <LogoMark size={28} />
              <span className="font-extrabold tracking-tight">Invoseal Onboarding</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Step {step + 1} of 2</span>
            <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 2`}>
              {[0, 1].map((i) => (
                <motion.span key={i} animate={{ width: i === step ? 28 : 12, backgroundColor: i <= step ? '#121416' : '#cdd3d6' }} className="h-1.5 rounded-full" />
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 0 ? (
            <motion.div key="role" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={soft} className="mt-6 flex flex-1 flex-col">
              <p className="text-xs font-semibold text-muted">Signed in as {session?.user.email}</p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">How will you use Invoseal?</h1>
              <p className="mt-1 text-sm text-muted">Choose your role. Each role gets a dedicated portal tailored for their workflow.</p>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {option('supplier', 'I sell goods', 'Upload invoices your buyers pay later. Get up to 85% advance today.', 'up')}
                {option('buyer', 'I buy goods', 'Raise purchase orders, record deliveries, and confirm invoices.', 'down')}
                {option('lender', 'I lend money', 'Review invoices ranked by risk, approve advances, and verify the audit chain.', 'chart')}
              </div>

              <div className="mt-6 flex items-center gap-2.5 rounded-2xl bg-ground px-4 py-3 text-xs text-ink-3">
                <Icon name="info" size={18} /> Prototype preview: no KYC, Aadhaar or PAN verification required.
              </div>

              <div className="mt-8 flex justify-end">
                <Btn type="button" className="px-8" onClick={() => setStep(1)} icon="next">
                  Continue as {role === 'supplier' ? 'Seller' : role === 'buyer' ? 'Buyer' : 'Lender'}
                </Btn>
              </div>
            </motion.div>
          ) : (
            <motion.form key="biz" onSubmit={submit} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={soft} className="mt-6 flex flex-1 flex-col">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {role === 'lender' ? 'Your lending desk' : 'Your business details'}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {role === 'lender' ? 'Shown on your dashboard and in the audit trail when you approve or reject advances.'
                  : 'Used to match invoices against purchase orders and detect self-dealing. Made-up values are fine.'}
              </p>

              {role === 'lender' ? (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-line bg-ground/40 p-4">
                  <Field label="Lending company" required minLength={2} value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Kaveri Capital" autoFocus />
                  <Field label="Your name (optional)" value={person} onChange={(e) => setPerson(e.target.value)} placeholder={meta.full_name ?? meta.name ?? 'Asha Menon'} />
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-line bg-ground/40 p-4">
                  <Field label="Business name" required minLength={2} value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder={role === 'supplier' ? 'Sunrise Packaging' : 'Metro Mart'} autoFocus />
                  <Field label="GSTIN (optional)" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="33AAACS1234F1Z5" maxLength={18} />
                  <Field label={role === 'supplier' ? 'Bank account for payouts' : 'Bank account you pay from'} required inputMode="numeric" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="5012 3400 8811" />
                  <Field label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Coimbatore" />
                </div>
              )}

              <div className="relative mt-5 flex items-center gap-3 overflow-hidden rounded-2xl bg-ink px-4 py-3.5 text-xs text-soft">
                <Rings className="-right-10 -top-10 h-28 w-28" />
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime text-ink">
                  <Icon name="shield" size={16} />
                </span>
                <span className="relative">
                  {role === 'lender' ? 'Lenders inspect all submitted invoices and make approval decisions. Prototype mode: no real funds transferred.'
                    : 'Bank account numbers are masked throughout the UI. Your files are encrypted and private.'}
                </span>
              </div>

              {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

              <div className="mt-8 flex items-center justify-between">
                <button type="button" onClick={() => setStep(0)} className="text-sm font-semibold text-muted hover:text-ink">
                  ← Back to role selection
                </button>
                <Btn type="submit" busy={busy} icon="next" className="px-8">Create my account</Btn>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
