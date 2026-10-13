import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './supabase'

export type Role = 'supplier' | 'buyer' | 'lender' | 'auditor'
export type Profile = { id: string; role: Role; party_id: string | null; full_name: string; party_name: string | null; city: string | null }
type Auth = {
  session: Session | null
  /** null after sign-in = a new account that still has to pick a role (onboarding). */
  profile: Profile | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<Auth>({ session: null, profile: null, loading: true, refresh: async () => {}, signOut: async () => {} })
export const useAuth = () => useContext(Ctx)
export const HOME: Record<Role, string> = { supplier: '/s', buyer: '/b', lender: '/l', auditor: '/a' }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(configured)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  const load = useCallback(async () => {
    if (!uid) { setProfile(null); setLoading(false); return }
    const { data } = await supabase.from('profiles').select('id, role, party_id, full_name, parties(name, city)').eq('id', uid).maybeSingle()
    const party = (data?.parties ?? null) as unknown as { name: string; city: string | null } | null
    setProfile(data ? { id: data.id, role: data.role, party_id: data.party_id, full_name: data.full_name, party_name: party?.name ?? null, city: party?.city ?? null } : null)
    setLoading(false)
  }, [uid])
  useEffect(() => { setLoading(Boolean(uid)); load() }, [load, uid])

  const signOut = async () => { await supabase.auth.signOut(); setProfile(null) }
  return <Ctx.Provider value={{ session, profile, loading, refresh: load, signOut }}>{children}</Ctx.Provider>
}
