import { Navigate, Outlet, Route, Routes } from 'react-router'
import { motion } from 'motion/react'
import { HOME, useAuth, type Role } from './lib/auth'
import { configured } from './lib/supabase'
import { LogoMark } from './ui/kit'
import { RoleShell } from './ui/RoleShell'
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
      <Route element={<RoleShell />}>
        <Route element={<Only roles={['supplier']} />}>
          <Route path="/s" element={<SellerHome />} />
          <Route path="/s/invoices" element={<SellerInvoices />} />
          <Route path="/s/upload" element={<Upload />} />
          <Route path="/s/review/:id" element={<Review />} />
          <Route path="/s/invoice/:id" element={<InvoiceScreen />} />
          <Route path="/s/payouts" element={<Payouts />} />
          <Route path="/s/profile" element={<Profile />} />
        </Route>
        <Route element={<Only roles={['buyer']} />}>
          <Route path="/b" element={<BuyerHome />} />
          <Route path="/b/invoices" element={<BuyerInvoices />} />
          <Route path="/b/invoice/:id" element={<InvoiceScreen />} />
          <Route path="/b/orders" element={<Orders />} />
          <Route path="/b/orders/new" element={<NewPO />} />
          <Route path="/b/profile" element={<Profile />} />
        </Route>
        <Route element={<Only roles={['lender']} />}>
          <Route path="/l" element={<LenderDashboard />} />
          <Route path="/l/all" element={<LenderDashboard />} />
          <Route path="/l/portfolio" element={<Portfolio />} />
          <Route path="/l/chain" element={<Chain />} />
          <Route path="/l/profile" element={<Profile />} />
        </Route>
        <Route element={<Only roles={['lender', 'auditor']} />}>
          <Route path="/l/invoice/:id" element={<LenderInvoice />} />
        </Route>
        <Route element={<Only roles={['auditor']} />}>
          <Route path="/a" element={<Chain />} />
          <Route path="/a/invoices" element={<LenderDashboard />} />
          <Route path="/a/profile" element={<Profile />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={HOME[profile.role]} replace />} />
    </Routes>
  )
}
