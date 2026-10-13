import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '../../lib/supabase'
import { signInWithGoogle } from '../../lib/oauth'
import { Btn, ErrorNote, LogoMark, RoundBtn } from '../../ui/kit'
import { spring } from '../../ui/motion'

// Seeded mock accounts for judges: pick one, type the shared demo password.
const DEMO = [
  ['ravi@invoseal.test', 'Ravi Plastics', 'Seller'],
  ['kaveri@invoseal.test', 'Kaveri Traders', 'Seller'],
  ['peacock@invoseal.test', 'Peacock Retail', 'Buyer'],
  ['banyan@invoseal.test', 'Banyan Stores', 'Buyer'],
  ['lender@invoseal.test', 'Asha Menon', 'Lender'],
  ['auditor@invoseal.test', 'Audit desk', 'Auditor'],
] as const

const DEMO_PW = (import.meta as any).env?.VITE_DEMO_PASSWORD || 'demo-3DPVGs24EWaOQ3Bf'

export function EmailAuth() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const lender = params.get('role') === 'lender'
  const paramEmail = params.get('email')
  const [email, setEmail] = useState(paramEmail || (lender ? 'lender@invoseal.test' : ''))
  const isDemo = lender || (paramEmail && paramEmail.endsWith('@invoseal.test'))
  const [password, setPassword] = useState(isDemo ? DEMO_PW : '')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(params.get('demo') === '1' || Boolean(paramEmail) || lender)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const fn = mode === 'in' ? supabase.auth.signInWithPassword({ email: email.trim(), password }) : supabase.auth.signUp({ email: email.trim(), password })
    const { error: err } = await fn
    if (err) {
      setError(err.message === 'Invalid login credentials' ? "That email and password don't match."
        : err.message.includes('already registered') ? 'That email already has an account. Sign in instead.'
          : err.message.toLowerCase().includes('password') ? 'Use a password with at least 6 characters.' : 'Could not sign in. Check your connection and try again.')
    }
    setBusy(false) // on success the router moves on (new accounts go to onboarding)
  }

  return (
    <div className="min-h-dvh bg-ground flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="w-full max-w-xl bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(18,20,22,0.1)] border border-line flex flex-col">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <RoundBtn icon="back" label="Back to welcome" to="/welcome" />
          <Link to="/welcome" className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="text-base font-extrabold tracking-tight">Invoseal</span>
          </Link>
          <div className="w-12" />
        </div>

        <h1 className="mt-6 text-2xl sm:text-3xl font-extrabold leading-tight tracking-[-0.03em]">
          {lender ? 'Lender sign in' : mode === 'in' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {lender ? 'Opens the lender dashboard: review queue, portfolio and audit chain.'
            : mode === 'in' ? 'Sign in with your email and password to access your dashboard.'
              : 'Then tell us if you sell or buy. No KYC in this prototype.'}
        </p>

        {lender && (
          <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => signInWithGoogle().catch((e) => setError((e as Error).message))}
            className="mt-5 flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-ink text-sm font-bold text-white transition hover:bg-ink-2">
            Continue with Google <span className="text-xs font-normal text-soft">· then choose "I lend money"</span>
          </motion.button>
        )}

        {/* Tab switcher */}
        <div role="tablist" className="relative mt-5 grid grid-cols-2 rounded-2xl bg-ground p-1">
          {(['in', 'up'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null) }} className="relative h-10 rounded-xl text-sm font-semibold">
              {mode === m && <motion.span layoutId="auth-tab" transition={spring} className="absolute inset-0 rounded-xl bg-ink shadow-sm" />}
              <span className={`relative ${mode === m ? 'text-white' : 'text-muted'}`}>{m === 'in' ? 'Sign in' : 'Create account'}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={submit} className="mt-5 flex flex-col space-y-4">
          <div className="rounded-2xl border border-line bg-ground/50 px-4 py-1 divide-y divide-line">
            <label className="block py-2.5">
              <span className="block text-xs font-semibold text-muted">Email</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com"
                className="mt-0.5 w-full bg-transparent text-[16px] font-bold outline-none placeholder:font-medium placeholder:text-soft" />
            </label>
            <label className="block py-2.5">
              <span className="block text-xs font-semibold text-muted">Password</span>
              <span className="flex items-center gap-2">
                <input type={show ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'in' ? 'Your password' : 'At least 6 characters'} className="mt-0.5 w-full bg-transparent text-[16px] font-bold outline-none placeholder:font-medium placeholder:text-soft" />
                <button type="button" onClick={() => setShow(!show)} className="rounded-lg px-2 py-1 text-xs font-bold text-ink-3 hover:bg-white">{show ? 'Hide' : 'Show'}</button>
              </span>
            </label>
          </div>

          {/* Demo accounts picker for judges */}
          <div className="rounded-2xl border border-line bg-ground/30 p-3">
            <button type="button" onClick={() => setDemoOpen(!demoOpen)} aria-expanded={demoOpen}
              className="flex w-full items-center justify-between text-xs font-bold text-ink">
              <span>Demo accounts for judges</span>
              <span className="text-[11px] font-semibold text-muted">{demoOpen ? 'Hide' : 'Show pre-seeded accounts'}</span>
            </button>
            <AnimatePresence initial={false}>
              {demoOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
                    {DEMO.map(([e, who, role]) => (
                      <button type="button" key={e} onClick={() => { setEmail(e); setPassword(DEMO_PW); setMode('in') }}
                        className={`rounded-xl p-2.5 text-left transition border ${email === e ? 'bg-ink text-white border-ink' : 'bg-white border-line hover:border-ink-3'}`}>
                        <span className="block text-xs font-bold truncate">{who}</span>
                        <span className={`block text-[11px] ${email === e ? 'text-lime' : 'text-muted'}`}>{role}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}
          <Btn type="submit" busy={busy} icon="next" className="w-full">{mode === 'in' ? 'Sign in' : 'Create account'}</Btn>
        </form>
      </div>
    </div>
  )
}
