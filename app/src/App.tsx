import { useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useOutlet } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { HOME, useAuth, type Role } from './lib/auth'
import { configured } from './lib/supabase'
import { LogoMark } from './ui/kit'
import { MobileShell } from './ui/MobileShell'
import { Welcome } from './screens/auth/Welcome'
import { EmailAuth } from './screens/auth/EmailAuth'
import { Onboarding } from './screens/auth/Onboarding'
import { SellerHome } from './screens/seller/Home'
import { Upload } from './screens/seller/Upload'
import { Review } from './screens/seller/Review'
import { Payouts, SellerInvoices } from './screens/seller/Invoices'
import { BuyerHome, BuyerInvoices } from './screens/buyer/Home'
import { NewPO, Orders } from './screens/buyer/Orders'
import { InvoiceScreen } from './screens/InvoiceScreen'
import { Profile } from './screens/Profile'
import { LenderDashboard, LenderInvoice, Portfolio } from './screens/lender/Dashboard'
import { Chain } from './screens/audit/Chain'

/** Keeps the old screen on stage while it animates out (the outlet would otherwise switch instantly). */
function Frozen() {
  const o = useOutlet()
  const [frozen] = useState(o)
  return frozen
}
function AnimatedOutlet() {
  const loc = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={loc.pathname} exit={{ opacity: 0, transition: { duration: 0.12 } }}><Frozen /></motion.div>
    </AnimatePresence>
  )
}

/** Routing is a convenience: RLS and the edge functions enforce every role on the server. */
function Only({ roles }: { roles: Role[] }) {
  const { profile } = useAuth()
  if (!profile) return <Navigate to="/" replace />
  if (!roles.includes(profile.role)) return <Navigate to={HOME[profile.role]} replace />
  return <Outlet />
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground">
      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}><LogoMark size={56} /></motion.div>
    </div>
  )
}

export function App() {
  const { session, profile, loading } = useAuth()
  if (!configured) return <div className="p-6 text-sm">Supabase isn't configured: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local at the repo root.</div>
  if (loading) return <Splash />

  if (!session) {
    return (
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/auth/email" element={<EmailAuth />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    )
  }
  if (!profile) return <Routes><Route path="*" element={<Onboarding />} /></Routes>

  return (
    <Routes>
      <Route element={<Only roles={['supplier']} />}>
        <Route element={<MobileShell role="supplier"><AnimatedOutlet /></MobileShell>}>
          <Route path="/s" element={<SellerHome />} />
          <Route path="/s/invoices" element={<SellerInvoices />} />
          <Route path="/s/upload" element={<Upload />} />
          <Route path="/s/review/:id" element={<Review />} />
          <Route path="/s/invoice/:id" element={<InvoiceScreen />} />
          <Route path="/s/payouts" element={<Payouts />} />
          <Route path="/s/profile" element={<Profile />} />
        </Route>
      </Route>
      <Route element={<Only roles={['buyer']} />}>
        <Route element={<MobileShell role="buyer"><AnimatedOutlet /></MobileShell>}>
          <Route path="/b" element={<BuyerHome />} />
          <Route path="/b/invoices" element={<BuyerInvoices />} />
          <Route path="/b/invoice/:id" element={<InvoiceScreen />} />
          <Route path="/b/orders" element={<Orders />} />
          <Route path="/b/orders/new" element={<NewPO />} />
          <Route path="/b/profile" element={<Profile />} />
        </Route>
      </Route>
      <Route element={<Only roles={['lender']} />}>
        <Route path="/l" element={<LenderDashboard />} />
        <Route path="/l/portfolio" element={<Portfolio />} />
        <Route path="/l/chain" element={<Chain />} />
      </Route>
      <Route element={<Only roles={['lender', 'auditor']} />}>
        <Route path="/l/invoice/:id" element={<LenderInvoice />} />
      </Route>
      <Route element={<Only roles={['auditor']} />}>
        <Route path="/a" element={<Chain />} />
        <Route path="/a/invoices" element={<LenderDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to={HOME[profile.role]} replace />} />
    </Routes>
  )
}
