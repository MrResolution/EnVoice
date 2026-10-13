// Web interface for every role: sidebar navigation + a wide content area.
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
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
const ROLE_NAME: Record<Role, string> = { supplier: 'Seller', buyer: 'Buyer', lender: 'Lender', auditor: 'Auditor' }

export function DeskShell({ children, badge }: { children: ReactNode; badge?: number }) {
  const { profile, signOut } = useAuth()
  const role = profile?.role ?? 'supplier'
  const items = DESK_NAV[role]
  const primary = items.find((i) => i.primary)
  return (
    <div className="flex min-h-dvh bg-ground">
      <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col gap-1 border-r border-line bg-white px-3.5 py-6">
        <div className="flex items-center gap-2.5 px-2 pb-6"><LogoMark size={32} /><span className="text-lg font-extrabold">Invoseal</span></div>
        {primary && (
          <NavLink to={primary.to} className="mb-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-lime text-sm font-bold transition-transform active:scale-[0.97]">
            <Icon name={primary.icon} size={18} />{primary.label}
          </NavLink>
        )}
        <nav className="flex flex-col gap-1">
          {items.filter((i) => !i.primary).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="relative flex min-h-11 items-center gap-2.5 rounded-2xl px-3.5 text-sm">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="desk-nav" transition={spring} className="absolute inset-0 rounded-2xl bg-ink" />}
                  <span className={`relative flex flex-1 items-center gap-2.5 ${isActive ? 'font-semibold text-white' : 'text-ink-3'}`}>
                    <Icon name={n.icon} size={18} stroke={isActive ? 'var(--color-lime)' : 'currentColor'} />{n.label}
                    {n.end && n.to === '/l' && !!badge && <span className="ml-auto rounded-full bg-lime px-2 py-0.5 text-[11px] font-extrabold text-ink">{badge}</span>}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-ground p-3">
          <div className="truncate text-sm font-bold">{profile?.party_name ?? profile?.full_name}</div>
          <div className="text-xs text-muted">{ROLE_NAME[role]}{profile?.city ? ` · ${profile.city}` : ''}</div>
          <button onClick={signOut} className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-3 hover:text-ink"><Icon name="logout" size={16} />Sign out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-7"><div className="mx-auto max-w-[1280px]">{children}</div></main>
    </div>
  )
}
