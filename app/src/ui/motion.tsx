// Motion building blocks. Springs everywhere (no linear tweens), and everything respects
// "reduce motion" through <MotionConfig reducedMotion="user"> in main.tsx.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion, type HTMLMotionProps, type PanInfo } from 'motion/react'
import { Icon } from './Icon'

export const spring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const
export const soft = { type: 'spring', stiffness: 260, damping: 30 } as const

/** A screen: slides and fades in, so moving between screens feels like one app, not page loads. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }} transition={soft}>
      {children}
    </motion.div>
  )
}

/** Children appear one after another (lists, check results). */
export function Stagger({ children, className = '', gap = 0.045, as = 'div' }: { children: ReactNode; className?: string; gap?: number; as?: 'div' | 'ul' | 'ol' }) {
  const M = motion[as]
  return (
    <M className={className} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: gap } } }}>
      {children}
    </M>
  )
}
export const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: soft } }
export function StaggerItem({ children, className = '', as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const M = motion[as]
  return <M className={className} variants={item}>{children}</M>
}

/** Buttons and cards shrink a little under the finger, like native controls. */
export function Press({ children, className = '', ...p }: HTMLMotionProps<'button'>) {
  return <motion.button whileTap={{ scale: 0.96 }} transition={spring} className={className} {...p}>{children}</motion.button>
}

/** Animates a number up to its value (₹ figures, scores). Formats with the function given. */
export function CountUp({ value, format, duration = 0.9 }: { value: number; format: (n: number) => string; duration?: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(reduce ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduce) { setShown(value); return }
    const c = animate(from.current, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(v) })
    from.current = value
    return () => c.stop()
  }, [value, reduce, duration])
  return <>{format(Math.round(shown * 100) / 100)}</>
}

/** Bottom sheet: slides up, drag down (or tap outside) to close. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const y = useMotionValue(0)
  const controls = useDragControls() // drag from the handle/title only, so lists inside still scroll
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.button aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.section role="dialog" aria-modal="true" aria-label={title} style={{ y }}
            className="relative w-full max-w-[460px] rounded-t-[32px] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring}
            drag="y" dragControls={controls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={onDragEnd}>
            <div className="-mx-5 -mt-3 cursor-grab touch-none px-5 pt-3" onPointerDown={(e) => controls.start(e)}>
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
              <h2 className="mb-4 text-lg font-bold">{title}</h2>
            </div>
            {children}
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  )
}

// ---------- Toasts: short confirmations that slide in from the top ----------
type Toast = { id: number; text: string; tone: 'ok' | 'bad' | 'info' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: -24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.96 }} transition={spring}
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-xl">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${t.tone === 'bad' ? 'bg-bad' : t.tone === 'info' ? 'bg-ink-3' : 'bg-lime text-ink'}`}>
                <Icon name={t.tone === 'bad' ? 'x' : t.tone === 'info' ? 'bell' : 'check'} size={14} width={2.6} />
              </span>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

/** A short buzz on phones that support it (Android WebView does): feedback for confirm, accept, submit. */
export const buzz = (pattern: number | number[] = 12) => { try { navigator.vibrate?.(pattern) } catch { /* not supported */ } }
