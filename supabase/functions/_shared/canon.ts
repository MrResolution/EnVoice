// Canonical JSON + SHA-256. Same data must always give the same bytes, or the audit chain would
// report tampering that never happened. Works in Deno, Node and the browser (WebCrypto).

/** JSON with keys sorted at every level and no whitespace. undefined keys are dropped, like JSON.stringify. */
export function canon(v: unknown): string {
  if (v === null || v === undefined || typeof v !== 'object') return JSON.stringify(v ?? null)
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'
  const o = v as Record<string, unknown>
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}'
}

/** Lowercase hex SHA-256 of a string (UTF-8) or raw bytes. */
export async function sha256(data: string | Uint8Array | ArrayBuffer): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const buf = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const short = (hash: string | null | undefined) => (hash ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : '—')
