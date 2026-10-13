// Normalise values before comparing them, so "₹1,00,000" and "100000" are the same amount
// and "INV-1001" and "inv 1001" are the same invoice number. Pure functions, no imports.

export const round2 = (n: number) => Math.round(n * 100) / 100

/** "₹1,00,000.00", "Rs. 100000/-", 100000 → 100000. null when it isn't a number. */
export function money(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? round2(v) : null
  const s = String(v).replace(/₹|rs\.?|inr|rupees?/gi, '').replace(/\/-\s*$/, '').replace(/[,\s]/g, '')
  return /^-?\d+(\.\d+)?$/.test(s) ? round2(Number(s)) : null
}

/** "₹", "Rs.", "inr" → "INR". Other codes are upper-cased as printed. */
export function currency(v: unknown): string | null {
  if (v === null || v === undefined || String(v).trim() === '') return null
  const s = String(v).trim()
  return /^(₹|rs\.?|inr|rupees?)$/i.test(s) ? 'INR' : s.toUpperCase()
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Many spellings → YYYY-MM-DD. Numeric dates are day-first, as printed on Indian invoices. */
export function isoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1')
  let y = 0, m = 0, d = 0, r: RegExpMatchArray | null
  if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [+r[1], +r[2], +r[3]]
  else if ((r = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/))) [d, m, y] = [+r[1], +r[2], +r[3]]
  else if ((r = s.match(/^(\d{1,2})[\s\-]([a-z]{3})[a-z]*[\s\-,]+(\d{2,4})$/))) [d, m, y] = [+r[1], MONTHS.indexOf(r[2]) + 1, +r[3]]
  else if ((r = s.match(/^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/))) [m, d, y] = [MONTHS.indexOf(r[1]) + 1, +r[2], +r[3]]
  else return null
  if (y < 100) y += 2000
  const date = new Date(Date.UTC(y, m - 1, d))
  // Rejects 31/02 and month 0 instead of silently rolling over.
  if (m < 1 || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date.toISOString().slice(0, 10)
}

/** Whole days from a to b (both YYYY-MM-DD). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** "inv - 1001" → "INV1001": separators and case don't make a different invoice or PO. */
export function ref(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).toUpperCase().replace(/[\s\-/_.#:]/g, '')
  return s || null
}

const LOOKALIKE: Record<string, string> = { O: '0', I: '1', L: '1', S: '5', B: '8', Z: '2' }
/** Maps characters fraudsters swap (O↔0, I↔1, S↔5…) so "INV-1O01" collides with "INV-1001". */
export function lookalike(v: unknown): string | null {
  const s = ref(v)
  return s ? s.replace(/[OILSBZ]/g, (c) => LOOKALIKE[c]) : null
}

/** "M/s Ravi Plastics Pvt. Ltd." → "ravi plastics". Legal suffixes don't make a different company. */
export function name(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).toLowerCase().replace(/m\/s\.?/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(messrs|pvt|private|ltd|limited|llp|inc|co|company|corp|corporation|the)\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
  return s || null
}

export const gstin = (v: unknown) => (v ? String(v).toUpperCase().replace(/[^0-9A-Z]/g, '') || null : null)
export const digits = (v: unknown) => (v ? String(v).replace(/\D/g, '') || null : null)
export const address = (v: unknown) => (v ? String(v).toLowerCase().replace(/[^a-z0-9]/g, '') || null : null)
export const emailDomain = (v: unknown) => (v && String(v).includes('@') ? String(v).split('@').pop()!.toLowerCase() : null)
/** Only the last 4 digits ever reach the screen or the audit log. */
export const mask = (v: unknown) => '••' + (digits(v) ?? '').slice(-4)

/** Webmail domains say nothing about who owns a company, so they never count as "shared". */
export const PUBLIC_EMAIL = new Set(['gmail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'rediffmail.com', 'icloud.com', 'proton.me'])

export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

/** 1 = identical, 0 = nothing alike (edit distance relative to the longer string). */
export function similarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return a === b ? 1 : 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

const STOP = new Set(['and', 'the', 'of', 'for', 'with', 'pcs', 'nos', 'no'])
const words = (v: unknown) => new Set(String(v ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)))

/** Share of words two descriptions have in common (Jaccard, 0–1). */
export function overlap(a: unknown, b: unknown): number {
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return 0
  let common = 0
  for (const w of A) if (B.has(w)) common++
  return common / (A.size + B.size - common)
}

/** Bits that differ between two hex hashes (for the 64-bit image hash). null if not comparable. */
export function hamming(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b || a.length !== b.length) return null
  let bits = 0
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) { bits += x & 1; x >>= 1 }
  }
  return bits
}

// Display helpers, shared so reasons read the same on every screen.
const IN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
const PAISE = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** ₹2,40,000 for whole rupees, ₹36,610.20 (never .2) when there are paise. */
export const inr = (n: number | null | undefined) => (n === null || n === undefined ? '—' : '₹' + (Number.isInteger(round2(n)) ? IN : PAISE).format(n))
/** "Ravi Plastics'" not "Ravi Plastics's". */
export const poss = (s: string) => (s.endsWith('s') ? `${s}'` : `${s}'s`)
export const qty = (n: number | null | undefined) => (n === null || n === undefined ? '—' : IN.format(n))
export const pct = (x: number) => (x > 0 ? '+' : '') + (Math.round(x * 1000) / 10) + '%'
export const day = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'
export const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1])
