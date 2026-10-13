// Phone layout for sellers and buyers: content + a bottom tab bar with a raised centre action.
// On a laptop the same app sits in a phone-width column, so the demo looks like the APK.
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { motion } from 'motion/react'
import { Icon, type IconName } from './Icon'
import { spring } from './motion'
import { cx } from './kit'

type Tab = { to: string; label: string; icon: IconName; end?: boolean }
const TABS: Record<'supplier' | 'buyer', { left: Tab[]; fab: Tab; right: Tab[] }> = {
  supplier: {
    left: [{ to: '/s', label: 'Home', icon: 'grid', end: true }, { to: '/s/invoices', label: 'Invoices', icon: 'doc' }],
    fab: { to: '/s/upload', label: 'Scan an invoice', icon: 'scan' },
    right: [{ to: '/s/payouts', label: 'Payouts', icon: 'chart' }, { to: '/s/profile', label: 'Profile', icon: 'user' }],
  },
  buyer: {
    left: [{ to: '/b', label: 'Home', icon: 'grid', end: true }, { to: '/b/orders', label: 'Orders', icon: 'truck' }],
    fab: { to: '/b/orders/new', label: 'New purchase order', icon: 'plus' },
    right: [{ to: '/b/invoices', label: 'Invoices', icon: 'check' }, { to: '/b/profile', label: 'Profile', icon: 'user' }],
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

export function MobileShell({ role, children, bare }: { role: 'supplier' | 'buyer'; children: ReactNode; bare?: boolean }) {
  const tabs = TABS[role]
  return (
    <div className="min-h-dvh bg-[#e4e8ea] sm:py-6">
      <div className={cx('relative mx-auto min-h-dvh w-full max-w-[460px] bg-ground sm:min-h-[calc(100dvh-3rem)] sm:overflow-hidden sm:rounded-[40px] sm:shadow-[0_30px_80px_-30px_rgba(18,20,22,0.45)]')}>
        <div className={cx(!bare && 'pb-28')}>{children}</div>
        {!bare && (
          <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[460px] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:absolute sm:rounded-b-[40px]">
            <div className="flex items-center justify-around px-2 pt-2.5 pb-2">
              {tabs.left.map((t) => <TabLink key={t.to} t={t} />)}
              <NavLink to={tabs.fab.to} aria-label={tabs.fab.label}
                className="-mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-ink shadow-[0_0_0_6px_var(--color-ground)] transition-transform active:scale-95">
                <Icon name={tabs.fab.icon} size={26} stroke="var(--color-lime)" />
              </NavLink>
              {tabs.right.map((t) => <TabLink key={t.to} t={t} />)}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}

/** Header row used by inner screens: round back button, centred title, optional action. */
export function TopBar({ back, title, subtitle, action }: { back?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
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
