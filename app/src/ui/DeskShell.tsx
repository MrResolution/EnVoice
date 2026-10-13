// Web interface for every role: sidebar navigation + a wide content area.
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { motion } from 'motion/react'
import { useAuth, type Role } from '../lib/auth'
import { Icon, type IconName } from './Icon'
import { spring } from './motion'
import { LogoMark } from './kit'

type Item = { to: string; label: string; icon: IconName; end?: boolean; primary?: boolean }
export const DESK_NAV: Record<Role, Item[]> = {
  supplier: [
    { to: '/s', label: 'Dashboard', icon: 'grid', end: true },
    { to: '/s/invoices', label: 'Invoices', icon: 'doc' },
    { to: '/s/payouts', label: 'Payouts', icon: 'chart' },
    { to: '/s/profile', label: 'Profile', icon: 'user' },
    { to: '/s/upload', label: 'New invoice', icon: 'upload', primary: true },
  ],
  buyer: [
    { to: '/b', label: 'Dashboard', icon: 'grid', end: true },
    { to: '/b/invoices', label: 'Invoices to confirm', icon: 'check' },
    { to: '/b/orders', label: 'Purchase orders', icon: 'truck', end: true },
    { to: '/b/profile', label: 'Profile', icon: 'user' },
    { to: '/b/orders/new', label: 'New purchase order', icon: 'plus', primary: true },
  ],
  lender: [
    { to: '/l', label: 'Review queue', icon: 'list', end: true },
    { to: '/l/portfolio', label: 'Portfolio', icon: 'chart' },
    { to: '/l/chain', label: 'Audit chain', icon: 'link' },
    { to: '/l/profile', label: 'Profile', icon: 'user' },
  ],
  auditor: [
    { to: '/a', label: 'Audit chain', icon: 'link', end: true },
    { to: '/a/invoices', label: 'All invoices', icon: 'list' },
    { to: '/a/profile', label: 'Profile', icon: 'user' },
  ],
}

const ROLE_NAME: Record<Role, string> = {
  supplier: 'Seller Portal',
  buyer: 'Buyer Portal',
  lender: 'Lender Desk',
  auditor: 'Audit Desk',
}

export function DeskShell({ children, badge }: { children: ReactNode; badge?: number }) {
  const { profile, signOut } = useAuth()
  const role = profile?.role ?? 'supplier'
  const items = DESK_NAV[role]
  const primary = items.find((i) => i.primary)

  return (
    <div className="flex min-h-dvh bg-ground">
      {/* Sticky Left Sidebar */}
      <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col gap-1 border-r border-line bg-white px-4 py-6 z-30 shadow-sm">
        {/* Brand Header */}
        <Link to="/" className="flex items-center gap-3 px-2 pb-6">
          <LogoMark size={34} />
          <div>
            <span className="text-lg font-extrabold tracking-tight block">Invoseal</span>
            <span className="text-[11px] font-bold text-muted block -mt-0.5">{ROLE_NAME[role]}</span>
          </div>
        </Link>

        {/* Primary Action Button (New Invoice / New PO) */}
        {primary && (
          <NavLink to={primary.to} className="mb-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-lime text-sm font-bold text-ink transition-transform hover:bg-lime-deep active:scale-[0.98] shadow-sm">
            <Icon name={primary.icon} size={18} />
            {primary.label}
          </NavLink>
        )}

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          {items.filter((i) => !i.primary).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="relative flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-sm transition">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="desk-nav" transition={spring} className="absolute inset-0 rounded-2xl bg-ink" />}
                  <span className={`relative flex flex-1 items-center gap-3 ${isActive ? 'font-bold text-white' : 'font-medium text-ink-3 hover:text-ink'}`}>
                    <Icon name={n.icon} size={18} stroke={isActive ? 'var(--color-lime)' : 'currentColor'} />
                    {n.label}
                    {n.end && n.to === '/l' && !!badge && (
                      <span className="ml-auto rounded-full bg-lime px-2 py-0.5 text-[11px] font-extrabold text-ink">{badge}</span>
                    )}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom User Info & Sign Out */}
        <div className="mt-auto rounded-2xl bg-ground/80 border border-line p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-xs font-bold text-lime">
              {(profile?.party_name ?? profile?.full_name ?? '?').slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-ink">{profile?.party_name ?? profile?.full_name}</div>
              <div className="truncate text-[11px] text-muted">{ROLE_NAME[role]}{profile?.city ? ` · ${profile.city}` : ''}</div>
            </div>
          </div>
          <button onClick={signOut} className="mt-2.5 flex w-full items-center gap-2 text-xs font-semibold text-ink-3 hover:text-bad transition pt-2 border-t border-line">
            <Icon name="logout" size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Laptop Content Area */}
      <main className="min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-[1360px]">
          {children}
        </div>
      </main>
    </div>
  )
}
