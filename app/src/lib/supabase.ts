import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False when .env.local is missing: the app shows a setup message instead of failing on every call. */
export const configured = Boolean(url && key)

// The anon key is public by design; RLS decides what each signed-in user can read.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  // PKCE: Google sign-in returns a one-time code (web redirect or the Android deep link) that is exchanged here.
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
})

/** Calls an edge function and turns any failure into one sentence a person can act on. */
export async function call<T = Record<string, unknown>>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (!error) return data as T
  const res = (error as { context?: Response }).context
  let message = 'Could not reach the server. Check your connection and try again.'
  if (res && typeof res.json === 'function') {
    try { message = (await res.json()).error ?? message } catch { /* not JSON */ }
  }
  throw new Error(message)
}

export const BUCKET = 'invoices'
