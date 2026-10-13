// One stroke icon set (24px grid, 2px stroke) so every screen draws icons the same way.
const PATHS = {
  back: 'M19 12H5 M11 6l-6 6 6 6',
  next: 'M5 12h14 M13 6l6 6-6 6',
  up: 'M7 17L17 7 M8 7h9v9',
  down: 'M17 7L7 17 M16 17H7V8',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12 M18 6L6 18',
  plus: 'M12 5v14 M5 12h14',
  scan: 'M4 8V5h3 M17 5h3v3 M20 16v3h-3 M7 19H4v-3 M8 12h8',
  upload: 'M12 15V4 M7 9l5-5 5 5 M5 20h14',
  clock: 'M12 4a8 8 0 100 16 8 8 0 000-16z M12 8v4l3 2',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  doc: 'M5 3h14v18H5z M9 8h6 M9 12h6',
  chart: 'M4 19V9 M10 19V5 M16 19v-7 M21 19H3',
  user: 'M12 4a4 4 0 100 8 4 4 0 000-8z M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  truck: 'M3 7h11v9H3z M14 10h4l3 3v3h-7 M7 16a2 2 0 100 4 2 2 0 000-4z M17 16a2 2 0 100 4 2 2 0 000-4z',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z M9 12l2 2 4-4',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9 M10 21h4',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14z M20 20l-3.5-3.5',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1 M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  list: 'M4 6h16 M4 12h16 M4 18h10',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 8v5 M12 16h.01',
  alert: 'M12 7v6 M12 17h.01',
  building: 'M3 21h18 M5 21V8l7-5 7 5v13 M9 21v-6h6v6',
  mail: 'M3 5h18v14H3z M3 7l9 6 9-6',
  logout: 'M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 10a3 3 0 100 6 3 3 0 000-6z',
  file: 'M6 3h9l4 4v14H6z M14 3v5h5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  refresh: 'M20 11a8 8 0 10-2.3 5.7 M20 4v7h-7',
  wallet: 'M4 7h15v12H4z M4 7l12-3v3 M15 13h2',
  chevron: 'M9 6l6 6-6 6',
} as const
export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, stroke = 'currentColor', width = 2, className }: { name: IconName; size?: number; stroke?: string; width?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {PATHS[name].split(' M').map((d, i) => <path key={i} d={i ? 'M' + d : d} />)}
    </svg>
  )
}

/** The decorative concentric rings on dark cards. */
export function Rings({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 140" aria-hidden className={`pointer-events-none absolute ${className}`}>
      {[24, 44, 64].map((r) => <circle key={r} cx="70" cy="70" r={r} fill="none" stroke="var(--color-ring)" strokeWidth="2" />)}
    </svg>
  )
}
