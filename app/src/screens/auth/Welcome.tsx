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
    <div className="flex min-h-dvh justify-center bg-[#e4e8ea] sm:items-center sm:py-6">
      <div className="relative flex min-h-dvh w-full max-w-[460px] flex-col overflow-hidden bg-ground px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] sm:min-h-[820px] sm:rounded-[40px] sm:shadow-[0_30px_80px_-30px_rgba(18,20,22,0.45)]">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5">
          <LogoMark size={34} /><span className="text-xl font-extrabold tracking-tight">Invoseal</span>
        </motion.div>

        <div className="relative mt-4 h-[290px]" aria-hidden>
          <motion.div initial={{ opacity: 0, x: -40, rotate: -14 }} animate={{ opacity: 1, x: 0, rotate: -6 }} transition={{ ...soft, delay: 0.1 }} className="absolute left-0 top-8">
            <motion.div animate={float(0)} className="h-[140px] w-[228px] rounded-3xl bg-ink p-[18px] text-white">
              <div className="text-xs text-soft">Invoice INV-1001</div>
              <div className="mt-2 text-[26px] font-bold tracking-tight">₹2,40,000</div>
              <div className="mt-3.5 text-xs text-soft">Peacock Retail · due 9 Dec</div>
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 40, rotate: 12 }} animate={{ opacity: 1, x: 0, rotate: 4 }} transition={{ ...soft, delay: 0.25 }} className="absolute right-0 top-[104px]">
            <motion.div animate={float(1.2)} className="h-[150px] w-[222px] rounded-3xl bg-lime p-[18px]">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold">Advance released</span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-lime"><Icon name="check" size={14} width={3} /></span></div>
              <div className="mt-2.5 text-[28px] font-extrabold tracking-tight">₹2,04,000</div>
              <div className="mt-2.5 text-xs">85% · 21 checks passed</div>
            </motion.div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...soft, delay: 0.45 }}
            className="absolute left-8 top-[226px] flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold shadow-[0_8px_24px_rgba(18,20,22,0.12)]">
            <Icon name="shield" size={16} />Audit chain verified
          </motion.div>
        </div>

        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.3 }} className="mt-1 text-[40px] font-extrabold leading-[1.05] tracking-[-0.035em]">
          Cash today<br />for invoices<br />paid later.
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-3 text-[15px] leading-relaxed text-muted">
          Upload an invoice, your buyer confirms, a lender advances up to 85%. Every check explained.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.55 }} className="mt-auto space-y-2.5 pt-6">
          {error && <ErrorNote>{error}</ErrorNote>}
          <motion.button whileTap={{ scale: 0.97 }} onClick={onGoogle} className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-ink text-base font-bold text-white">
            <GoogleG />Continue with Google
          </motion.button>
          <Link to="/auth/email" className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-white text-base font-bold ring-1 ring-line transition-transform active:scale-[0.97]">
            <Icon name="mail" />Continue with email
          </Link>
          <Link to="/auth/email?role=lender" className="flex h-14 w-full items-center gap-3 rounded-full bg-lime pl-2 pr-5 text-left transition-transform active:scale-[0.97]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-lime"><Icon name="chart" size={18} /></span>
            <span className="flex-1"><span className="block text-[15px] font-bold leading-tight">I'm a lender</span><span className="block text-xs leading-tight">open the web dashboard</span></span>
            <Icon name="next" size={18} />
          </Link>
          <Link to="/auth/email?demo=1" className="block pt-1.5 text-center text-xs text-muted underline-offset-2 hover:underline">
            Try a demo account · prototype with mock data, no real money
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
