// Web dashboard layout for the lender and the auditor: sidebar (top tabs on a phone) + content.
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { Icon, type IconName } from './Icon'
import { spring } from './motion'
import { LogoMark } from './kit'

const NAV: Record<'lender' | 'auditor', { to: string; label: string; icon: IconName; end?: boolean }[]> = {
  lender: [
    { to: '/l', label: 'Review queue', icon: 'list', end: true },
    { to: '/l/portfolio', label: 'Portfolio', icon: 'chart' },
    { to: '/l/chain', label: 'Audit chain', icon: 'link' },
  ],
  auditor: [{ to: '/a', label: 'Audit chain', icon: 'link', end: true }, { to: '/a/invoices', label: 'All invoices', icon: 'list' }],
}

export function DeskShell({ children, badge }: { children: ReactNode; badge?: number }) {
  const { profile, signOut } = useAuth()
  const role = profile?.role === 'auditor' ? 'auditor' : 'lender'
  return (
    <div className="min-h-dvh bg-ground lg:flex">
      <aside className="sticky top-0 z-20 flex flex-col gap-1 border-b border-line bg-white px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-3.5 lg:py-6">
        <div className="flex items-center gap-2.5 px-2 pb-2 lg:pb-6">
          <LogoMark size={32} />
          <span className="text-lg font-extrabold">Invoseal</span>
          <button onClick={signOut} className="ml-auto min-h-11 rounded-xl px-3 text-sm font-medium text-muted hover:bg-ground lg:hidden">Sign out</button>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
          {NAV[role].map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="relative flex min-h-11 shrink-0 items-center gap-2.5 rounded-2xl px-3.5 text-sm">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="desk-nav" transition={spring} className="absolute inset-0 rounded-2xl bg-ink" />}
                  <span className={`relative flex items-center gap-2.5 ${isActive ? 'font-semibold text-white' : 'text-ink-3'}`}>
                    <Icon name={n.icon} size={18} stroke={isActive ? 'var(--color-lime)' : 'currentColor'} />{n.label}
                    {n.end && role === 'lender' && !!badge && <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-extrabold text-ink">{badge}</span>}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden lg:block">
          <div className="rounded-2xl bg-ground p-3">
            <div className="text-sm font-bold">{profile?.full_name}</div>
            <div className="text-xs capitalize text-muted">{role}</div>
            <button onClick={signOut} className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-3 hover:text-ink"><Icon name="logout" size={16} />Sign out</button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-7">{children}</main>
    </div>
  )
}
