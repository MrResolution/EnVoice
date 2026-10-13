import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { googleEnabled, signInWithGoogle } from '../../lib/oauth'
import { Icon } from '../../ui/Icon'
import { ErrorNote, LogoMark } from '../../ui/kit'
import { soft } from '../../ui/motion'

const float = (delay: number) => ({ y: [0, -6, 0], transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' as const, delay } })

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

const DEMO_PREVIEWS = [
  { email: 'ravi@invoseal.test', name: 'Ravi Plastics', role: 'Seller · Uploads & advances' },
  { email: 'peacock@invoseal.test', name: 'Peacock Retail', role: 'Buyer · POs & confirms' },
  { email: 'lender@invoseal.test', name: 'Asha Menon', role: 'Lender · Review queue & risk' },
  { email: 'auditor@invoseal.test', name: 'Audit Desk', role: 'Auditor · Merkle audit chain' },
]

export function Welcome() {
  const [google, setGoogle] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { googleEnabled().then(setGoogle) }, [])

  async function onGoogle() {
    setError(null)
    if (google === false) return setError("Google sign-in isn't switched on for this project yet. Use email for now.")
    try { await signInWithGoogle() } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="min-h-dvh bg-ground flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="w-full border-b border-line bg-white/80 backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={36} />
            <div>
              <span className="text-xl font-extrabold tracking-tight block">Invoseal</span>
              <span className="text-[11px] font-semibold text-muted block -mt-0.5">Invoice Financing Platform</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-lime/30 px-3 py-1 text-xs font-bold text-ink">
              <Icon name="shield" size={14} /> Hackathon Prototype
            </span>
            <Link to="/auth/email" className="rounded-full bg-white px-4 py-2 text-sm font-bold ring-1 ring-line hover:bg-ground transition">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 lg:py-14">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          
          {/* Left Column: Hero & Value Proposition */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={soft} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white">
              <span className="flex h-2 w-2 rounded-full bg-lime" />
              <span>Instant AI extraction · 21 rule checks · On-chain audit</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.035em] text-ink leading-[1.08]">
              Cash today <br className="hidden sm:inline" />
              for invoices <br className="hidden sm:inline" />
              paid later.
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="max-w-xl text-base sm:text-lg text-muted leading-relaxed">
              Upload an invoice, your buyer confirms, a lender advances up to 85%. Every decision is backed by 21 automated checks and an immutable cryptographic audit chain.
            </motion.p>

            {/* Feature Pills */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="flex flex-wrap gap-2.5 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-xs font-bold ring-1 ring-line">
                <Icon name="check" size={14} /> 3-Way PO & Delivery Match
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-xs font-bold ring-1 ring-line">
                <Icon name="shield" size={14} /> Tamper-Evident Merkle Roots
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-xs font-bold ring-1 ring-line">
                <Icon name="chart" size={14} /> Risk-Ranked Lender Queue
              </span>
            </motion.div>

            {/* Interactive Showcase Cards */}
            <div className="relative pt-4 sm:pt-6">
              <div className="relative flex flex-wrap gap-4 items-center">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...soft, delay: 0.3 }}
                  className="rounded-3xl bg-ink p-5 text-white shadow-xl w-64">
                  <div className="text-xs text-soft">Invoice INV-1001</div>
                  <div className="mt-1.5 text-2xl font-bold tracking-tight">₹2,40,000</div>
                  <div className="mt-2.5 flex items-center justify-between text-xs text-soft">
                    <span>Peacock Retail</span>
                    <span className="rounded-full bg-ink-2 px-2 py-0.5 text-lime font-semibold">Clean</span>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...soft, delay: 0.4 }}
                  className="rounded-3xl bg-lime p-5 text-ink shadow-xl w-64">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Advance released</span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-lime">
                      <Icon name="check" size={13} width={3} />
                    </span>
                  </div>
                  <div className="mt-1.5 text-2xl font-extrabold tracking-tight">₹2,04,000</div>
                  <div className="mt-2.5 text-xs font-semibold">85% · 21 checks passed</div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.5 }}
                  className="rounded-2xl bg-white px-4 py-3 text-xs font-bold shadow-md ring-1 ring-line flex items-center gap-2">
                  <Icon name="shield" size={16} /> Audit chain verified on-chain
                </motion.div>
              </div>
            </div>
          </div>

          {/* Right Column: Actions & Direct Demo Login */}
          <div className="lg:col-span-5">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.2 }}
              className="rounded-[32px] bg-white p-6 sm:p-8 shadow-[0_20px_60px_-20px_rgba(18,20,22,0.1)] border border-line">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">Get started</h2>
              <p className="mt-1 text-sm text-muted">Sign in or pick a role to experience the entire workflow.</p>

              {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

              <div className="mt-6 space-y-3">
                <motion.button whileTap={{ scale: 0.98 }} onClick={onGoogle}
                  className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl bg-ink text-base font-bold text-white transition hover:bg-ink-2">
                  <GoogleG /> Continue with Google
                </motion.button>

                <Link to="/auth/email"
                  className="flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl bg-ground text-base font-bold text-ink ring-1 ring-line transition hover:bg-white">
                  <Icon name="mail" size={18} /> Continue with email
                </Link>

                <Link to="/auth/email?role=lender"
                  className="flex h-14 w-full items-center gap-3 rounded-2xl bg-lime px-4 text-left transition hover:bg-lime-deep">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-lime">
                    <Icon name="chart" size={18} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-bold leading-tight">I'm a lender</span>
                    <span className="block text-xs text-ink-3 truncate leading-tight">Review queue, risk ranking & portfolio</span>
                  </span>
                  <Icon name="next" size={18} />
                </Link>
              </div>

              {/* One-Click Demo Access for Judges */}
              <div className="mt-6 pt-5 border-t border-line">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Test with demo accounts</span>
                  <span className="text-[11px] text-muted">Hackathon preview</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEMO_PREVIEWS.map((d) => (
                    <Link key={d.email} to={`/auth/email?email=${encodeURIComponent(d.email)}&demo=1`}
                      className="group flex flex-col rounded-2xl bg-ground p-3 hover:bg-ink hover:text-white transition text-left">
                      <span className="text-xs font-bold group-hover:text-white text-ink">{d.name}</span>
                      <span className="text-[11px] text-muted group-hover:text-lime truncate">{d.role}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-line bg-white px-6 py-4 text-center text-xs text-muted">
        Invoseal prototype for SYNESIS 26 · Mock invoice financing with automated checks & cryptographic audit trail
      </footer>
    </div>
  )
}
