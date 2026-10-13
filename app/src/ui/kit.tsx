// Visual primitives shared by the phone app and the lender dashboard.
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { motion, type HTMLMotionProps } from 'motion/react'
import { Icon, Rings, type IconName } from './Icon'
import { spring } from './motion'

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral' | 'lime' | 'dark'
const TONE: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad',
  neutral: 'bg-ground text-ink', lime: 'bg-lime text-ink', dark: 'bg-ink-2 text-lime',
}
export const toneOf = (s: string | null | undefined): Tone =>
  s === 'pass' || s === 'LOW' || s === 'offer_released' || s === 'approved' || s === 'checked' || s === 'confirmed' || s === 'accepted' ? 'ok'
    : s === 'warn' || s === 'MEDIUM' || s === 'review' || s === 'disputed' ? 'warn'
      : s === 'fail' || s === 'HIGH' || s === 'rejected' ? 'bad' : 'neutral'

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', TONE[tone], className)}>{children}</span>
}

export function Card({ children, className, ...p }: HTMLMotionProps<'section'>) {
  return <motion.section className={cx('rounded-[24px] bg-white p-4', className)} {...p}>{children}</motion.section>
}

/** The signature dark card with rings in the corner. */
export function DarkCard({ children, className, ringsAt = '-right-10 -top-10 h-36 w-36', ...p }: HTMLMotionProps<'section'> & { ringsAt?: string }) {
  return (
    <motion.section className={cx('relative overflow-hidden rounded-[26px] bg-ink text-white', className)} {...p}>
      <Rings className={ringsAt} />
      <div className="relative">{children as ReactNode}</div>
    </motion.section>
  )
}

type BtnKind = 'lime' | 'dark' | 'light' | 'ghost' | 'danger'
const KIND: Record<BtnKind, string> = {
  lime: 'bg-lime text-ink hover:bg-lime-deep', dark: 'bg-ink text-white hover:bg-ink-2', light: 'bg-white text-ink ring-1 ring-line hover:bg-ground',
  ghost: 'text-ink hover:bg-white', danger: 'bg-white text-bad ring-1 ring-bad/30 hover:bg-bad-soft',
}
export function Btn({ kind = 'lime', icon, children, className, busy, ...p }: HTMLMotionProps<'button'> & { kind?: BtnKind; icon?: IconName; busy?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} transition={spring} disabled={busy || p.disabled}
      className={cx('inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50', KIND[kind], className)} {...p}>
      {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children as ReactNode}
      {icon && !busy && <Icon name={icon} size={18} width={2.2} />}
    </motion.button>
  )
}

/** Round outlined button (back, share). */
export function RoundBtn({ icon, label, to, onClick, dark }: { icon: IconName; label: string; to?: string; onClick?: () => void; dark?: boolean }) {
  const cls = cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors', dark ? 'bg-ink-2 text-white' : 'bg-white text-ink ring-1 ring-line hover:bg-ground')
  if (to) return <Link to={to} aria-label={label} className={cls}><Icon name={icon} /></Link>
  return <motion.button whileTap={{ scale: 0.92 }} aria-label={label} onClick={onClick} className={cls}><Icon name={icon} /></motion.button>
}

export function Avatar({ name, dark, size = 44 }: { name: string; dark?: boolean; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
  return (
    <span style={{ width: size, height: size }} className={cx('flex shrink-0 items-center justify-center rounded-[14px] text-[13px] font-extrabold', dark ? 'bg-ink text-lime' : 'bg-ground text-ink')}>
      {initials}
    </span>
  )
}

/** Labelled input inside a white list card (onboarding, forms). */
export function Field({ label, hint, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cx('block border-b border-line py-3 last:border-0', className)}>
      <span className="block text-xs text-muted">{label}</span>
      <input {...p} className="mt-0.5 w-full bg-transparent text-[17px] font-bold text-ink outline-none placeholder:font-medium placeholder:text-soft" />
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx('skeleton rounded-2xl', className)} />

export function Empty({ icon = 'doc', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center rounded-[24px] bg-white px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ground"><Icon name={icon} size={24} /></span>
      <p className="mt-3 font-bold">{title}</p>
      {children && <div className="mt-1 max-w-xs text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  )
}

export const ErrorNote = ({ children }: { children: ReactNode }) => (
  <motion.div role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{children}</motion.div>
)

export function LogoMark({ size = 32, invert }: { size?: number; invert?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill={invert ? '#c9f24d' : '#121416'} />
      <path d="M19 13h18l8 8v30H19z" fill="#fff" />
      <path d="M37 13v8h8" fill={invert ? '#e8f9b5' : '#c9f24d'} />
      <circle cx="42" cy="45" r="10" fill={invert ? '#121416' : '#c9f24d'} />
      <path d="M37.5 45l3 3 6-6" stroke={invert ? '#c9f24d' : '#121416'} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
