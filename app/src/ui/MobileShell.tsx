// Mobile app layout for every role: content + a bottom tab bar with a raised centre action.
// Used by the APK and by phone-width browsers; laptops get DeskShell instead (see RoleShell).
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import type { Role } from '../lib/auth'
import { useDesktop } from '../lib/layout'
import { Icon, type IconName } from './Icon'
import { spring } from './motion'
import { cx } from './kit'

type Tab = { to: string; label: string; icon: IconName; end?: boolean }
const TABS: Record<Role, { left: Tab[]; fab: Tab; right: Tab[] }> = {
  supplier: {
    left: [{ to: '/s', label: 'Home', icon: 'grid', end: true }, { to: '/s/invoices', label: 'Invoices', icon: 'doc' }],
    fab: { to: '/s/upload', label: 'Scan an invoice', icon: 'scan' },
    right: [{ to: '/s/payouts', label: 'Payouts', icon: 'chart' }, { to: '/s/profile', label: 'Profile', icon: 'user' }],
  },
  buyer: {
    left: [{ to: '/b', label: 'Home', icon: 'grid', end: true }, { to: '/b/orders', label: 'Orders', icon: 'truck', end: true }],
    fab: { to: '/b/orders/new', label: 'New purchase order', icon: 'plus' },
    right: [{ to: '/b/invoices', label: 'Invoices', icon: 'check' }, { to: '/b/profile', label: 'Profile', icon: 'user' }],
  },
  lender: {
    left: [{ to: '/l', label: 'Queue', icon: 'list', end: true }, { to: '/l/portfolio', label: 'Portfolio', icon: 'chart' }],
    fab: { to: '/l/chain', label: 'Verify the audit chain', icon: 'shield' },
    right: [{ to: '/l/all', label: 'All', icon: 'doc' }, { to: '/l/profile', label: 'Profile', icon: 'user' }],
  },
  auditor: {
    left: [{ to: '/a', label: 'Chain', icon: 'link', end: true }],
    fab: { to: '/a', label: 'Verify the audit chain', icon: 'shield' },
    right: [{ to: '/a/invoices', label: 'Invoices', icon: 'list' }, { to: '/a/profile', label: 'Profile', icon: 'user' }],
  },
}

function TabLink({ t }: { t: Tab }) {
  return (
    <NavLink to={t.to} end={t.end} className="relative flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 text-[11px]">
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="tab-dot" transition={spring} className="absolute -top-2.5 h-[3px] w-6 rounded-full bg-ink" />}
          <Icon name={t.icon} size={22} stroke={isActive ? 'var(--color-ink)' : 'var(--color-muted)'} />
          <span className={isActive ? 'font-bold text-ink' : 'text-muted'}>{t.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function MobileShell({ role, children }: { role: Role; children: ReactNode }) {
  const tabs = TABS[role]
  return (
    <div className="min-h-dvh bg-[#e4e8ea] sm:py-6">
      <div className="relative mx-auto min-h-dvh w-full max-w-[460px] bg-ground sm:min-h-[calc(100dvh-3rem)] sm:overflow-hidden sm:rounded-[40px] sm:shadow-[0_30px_80px_-30px_rgba(18,20,22,0.45)]">
        <div className="pb-28">{children}</div>
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[460px] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:absolute sm:rounded-b-[40px]">
          <div className="flex items-center justify-around px-2 pb-2 pt-2.5">
            {tabs.left.map((t) => <TabLink key={t.to} t={t} />)}
            <NavLink to={tabs.fab.to} aria-label={tabs.fab.label}
              className="-mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-ink shadow-[0_0_0_6px_var(--color-ground)] transition-transform active:scale-95">
              <Icon name={tabs.fab.icon} size={26} stroke="var(--color-lime)" />
            </NavLink>
            {tabs.right.map((t) => <TabLink key={t.to} t={t} />)}
          </div>
        </nav>
      </div>
    </div>
  )
}

/** Screen header. Phone: round back button, centred title. Web: left-aligned page title with a back link. */
export function TopBar({ back, title, subtitle, action }: { back?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  const desktop = useDesktop()
  const nav = useNavigate()
  if (desktop) {
    return (
      <header className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {back && <button onClick={() => nav(-1)} className="mb-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><Icon name="back" size={16} />Back</button>}
          <h1 className="truncate text-[28px] font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
    )
  }
  return (
    <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-12">{back}</div>
      <div className="min-w-0 text-center">
        <h1 className="truncate text-lg font-bold">{title}</h1>
        {subtitle && <p className="truncate text-[13px] text-muted">{subtitle}</p>}
      </div>
      <div className="flex w-12 justify-end">{action}</div>
    </header>
  )
}

/** Horizontal padding for screen content: the phone needs it, the web content area already has it. */
export const pad = (desktop: boolean) => (desktop ? '' : 'px-[18px]')
export { cx }
