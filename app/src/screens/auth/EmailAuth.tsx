import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '../../lib/supabase'
import { Btn, ErrorNote, RoundBtn } from '../../ui/kit'
import { spring } from '../../ui/motion'

// Seeded mock accounts for judges: pick one, type the shared demo password.
const DEMO = [
  ['ravi@invoseal.test', 'Ravi Plastics', 'Seller'], ['kaveri@invoseal.test', 'Kaveri Traders', 'Seller'],
  ['peacock@invoseal.test', 'Peacock Retail', 'Buyer'], ['banyan@invoseal.test', 'Banyan Stores', 'Buyer'],
  ['lender@invoseal.test', 'Asha Menon', 'Lender'], ['auditor@invoseal.test', 'Audit desk', 'Auditor'],
] as const

export function EmailAuth() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(params.get('demo') === '1')

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
    <div className="flex min-h-dvh justify-center bg-[#e4e8ea] sm:items-center sm:py-6">
      <div className="flex min-h-dvh w-full max-w-[460px] flex-col bg-ground px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:min-h-[820px] sm:rounded-[40px] sm:shadow-[0_30px_80px_-30px_rgba(18,20,22,0.45)]">
        <div className="flex items-center justify-between"><RoundBtn icon="back" label="Back" to="/welcome" /><span /></div>
        <h1 className="mt-6 text-[30px] font-extrabold leading-tight tracking-[-0.03em]">{mode === 'in' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-muted">{mode === 'in' ? 'Sign in with your email and password.' : 'Then tell us if you sell or buy. No KYC in this prototype.'}</p>

        <div role="tablist" className="relative mt-5 grid grid-cols-2 rounded-full bg-white p-1">
          {(['in', 'up'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null) }} className="relative h-11 rounded-full text-sm font-semibold">
              {mode === m && <motion.span layoutId="auth-tab" transition={spring} className="absolute inset-0 rounded-full bg-ink" />}
              <span className={`relative ${mode === m ? 'text-white' : 'text-muted'}`}>{m === 'in' ? 'Sign in' : 'Create account'}</span>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-1 flex-col">
          <div className="rounded-[24px] bg-white px-4">
            <label className="block border-b border-line py-3">
              <span className="block text-xs text-muted">Email</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com"
                className="mt-0.5 w-full bg-transparent text-[17px] font-bold outline-none placeholder:font-medium placeholder:text-soft" />
            </label>
            <label className="block py-3">
              <span className="block text-xs text-muted">Password</span>
              <span className="flex items-center gap-2">
                <input type={show ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'in' ? 'Your password' : 'At least 6 characters'} className="mt-0.5 w-full bg-transparent text-[17px] font-bold outline-none placeholder:font-medium placeholder:text-soft" />
                <button type="button" onClick={() => setShow(!show)} className="min-h-11 rounded-xl px-2 text-xs font-bold text-ink-3">{show ? 'Hide' : 'Show'}</button>
              </span>
            </label>
          </div>

          <div className="mt-4">
            <button type="button" onClick={() => setDemoOpen(!demoOpen)} aria-expanded={demoOpen} className="flex min-h-11 w-full items-center justify-between rounded-2xl px-1 text-sm font-semibold">
              Demo accounts <span className="text-xs font-normal text-muted">{demoOpen ? 'hide' : 'for judges · shared password'}</span>
            </button>
            <AnimatePresence initial={false}>
              {demoOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {DEMO.map(([e, who, role]) => (
                      <button type="button" key={e} onClick={() => { setEmail(e); setMode('in') }}
                        className={`min-h-14 rounded-2xl px-3 py-2 text-left transition ${email === e ? 'bg-ink text-white' : 'bg-white'}`}>
                        <span className="block text-sm font-bold">{who}</span>
                        <span className={`block text-xs ${email === e ? 'text-lime' : 'text-muted'}`}>{role}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-auto space-y-3 pt-6">
            {error && <ErrorNote>{error}</ErrorNote>}
            <Btn type="submit" busy={busy} icon="next" className="w-full">{mode === 'in' ? 'Sign in' : 'Create account'}</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
