// Server-only helpers for edge functions (Deno): service client, caller's role, audit writes.
// Clients never write tables; every write in the system goes through code in this folder.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3'
import { GENESIS, entryHash, payloadHash, recordHash, recordView, type Payload } from './audit.ts'
import { sha256 } from './canon.ts'

export const BUCKET = 'invoices'
export type Role = 'supplier' | 'buyer' | 'lender' | 'auditor'
export type Caller = { id: string; role: Role; party_id: string | null }

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

/** A refusal with a message that is safe to show the user. */
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Wraps a handler: CORS, JSON body, the caller's verified role, and errors that don't leak internals. */
export function handle(roles: Role[], fn: (body: Record<string, unknown>, caller: Caller, db: SupabaseClient) => Promise<unknown>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST.')
      const db = admin()
      const caller = await whoIs(db, req)
      if (!roles.includes(caller.role)) throw new HttpError(403, `This action needs the ${roles.join(' or ')} role.`)
      const body = await req.json().catch(() => ({}))
      return json(await fn(body ?? {}, caller, db))
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status)
      console.error(e)
      return json({ error: 'Something went wrong on the server. Please try again.' }, 500)
    }
  })
}

async function whoIs(db: SupabaseClient, req: Request): Promise<Caller> {
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) throw new HttpError(401, 'Please sign in.')
  const { data, error } = await db.auth.getUser(jwt)
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.')
  const { data: p } = await db.from('profiles').select('id, role, party_id').eq('id', data.user.id).single()
  if (!p) throw new HttpError(403, 'This account has no role.')
  return p as Caller
}

export async function must<T>(q: PromiseLike<{ data: T; error: { message: string; code?: string } | null }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await q
  if (error) throw Object.assign(new Error(`${what}: ${error.message}`), { code: error.code })
  if (data === null) throw new HttpError(404, `${what} not found.`)
  return data as NonNullable<T>
}

/** Appends one entry. UNIQUE(prev_hash) makes concurrent appends collide; the loser re-reads the head and retries. */
export async function appendAudit(db: SupabaseClient, e: {
  invoice_id: string | null; event_type: string; file_hash?: string | null; record_hash?: string | null; summary: string; actor_id: string
}) {
  const payload: Payload = { invoice_id: e.invoice_id, file_hash: e.file_hash ?? null, record_hash: e.record_hash ?? null, summary: e.summary }
  const p_hash = await payloadHash(payload)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: head } = await db.from('audit_log').select('entry_hash').order('seq', { ascending: false }).limit(1).maybeSingle()
    const prev_hash = head?.entry_hash ?? GENESIS
    const ts = new Date().toISOString()
    const entry_hash = await entryHash(prev_hash, e.event_type, p_hash, ts)
    const { data, error } = await db.from('audit_log').insert({
      invoice_id: e.invoice_id, event_type: e.event_type, payload, payload_hash: p_hash, prev_hash, entry_hash, ts, actor_id: e.actor_id,
    }).select('seq').single()
    if (!error) return data.seq as number
    if (error.code !== '23505') throw new Error(`audit insert: ${error.message}`)
  }
  throw new Error('audit insert: the chain head kept moving, try again')
}

/** Re-reads the row (so Postgres number formatting is what gets hashed), stores the readable snapshot, returns the hash. */
export async function snapshotRecord(db: SupabaseClient, invoiceId: string) {
  const row = await must(db.from('invoices').select('*').eq('id', invoiceId).single(), 'Invoice')
  const hash = await recordHash(row)
  await db.from('invoices').update({ recorded_fields: recordView(row) }).eq('id', invoiceId)
  return { row, hash }
}

export async function fileBytes(db: SupabaseClient, path: string): Promise<Uint8Array | null> {
  const { data } = await db.storage.from(BUCKET).download(path)
  return data ? new Uint8Array(await data.arrayBuffer()) : null
}

export const fileHash = async (db: SupabaseClient, path: string) => {
  const bytes = await fileBytes(db, path)
  return bytes ? sha256(bytes) : null
}
