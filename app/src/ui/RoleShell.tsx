// Picks the interface: web (sidebar) on a laptop, mobile app (bottom tabs) on a phone or in the APK.
import { useState } from 'react'
import { useLocation, useOutlet } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { useDesktop } from '../lib/layout'
import { useInvoices } from '../lib/data'
import { DeskShell } from './DeskShell'
import { MobileShell } from './MobileShell'

/** Keeps the old screen on stage while it animates out (the outlet would otherwise switch instantly). */
function Frozen() {
  const o = useOutlet()
  const [frozen] = useState(o)
  return frozen
}
function AnimatedOutlet() {
  const loc = useLocation()
  return (
    // popLayout: the new screen mounts at once while the old one fades out on top. With "wait" a stalled exit
    // animation (background tab, battery saver) left the old screen up and navigation looked frozen.
    <div className="relative">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={loc.pathname} exit={{ opacity: 0, transition: { duration: 0.12 } }}><Frozen /></motion.div>
      </AnimatePresence>
    </div>
  )
}

function LenderBadge() {
  const { rows } = useInvoices()
  return rows?.filter((r) => r.status === 'review').length ?? 0
}

export function RoleShell() {
  const { profile } = useAuth()
  const desktop = useDesktop()
  const role = profile!.role
  const review = role === 'lender' ? LenderBadge() : 0 // eslint-disable-line react-hooks/rules-of-hooks
  return desktop ? <DeskShell badge={review}><AnimatedOutlet /></DeskShell> : <MobileShell role={role}><AnimatedOutlet /></MobileShell>
}
