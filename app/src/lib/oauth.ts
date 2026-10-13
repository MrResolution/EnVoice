// Google sign-in. On the web it is a normal redirect. In the Android app Google refuses sign-in inside an
// embedded WebView, so the system browser opens and the app's deep link brings the user back with a code.
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'
import { supabase } from './supabase'

export const NATIVE_REDIRECT = 'test.invoseal.app://login-callback'

/** True when Google is switched on for the project (read from the public auth settings). */
export async function googleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } })
    return Boolean((await res.json())?.external?.google)
  } catch { return false }
}

export async function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true } })
    if (error) throw error
    await Browser.open({ url: data.url, presentationStyle: 'popover' })
    return
  }
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } })
  if (error) throw error
}

/** Android: catch test.invoseal.app://login-callback?code=… and finish the sign-in. */
export function listenForNativeLogin() {
  if (!Capacitor.isNativePlatform()) return
  App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_REDIRECT)) return
    const code = new URL(url).searchParams.get('code')
    if (code) await supabase.auth.exchangeCodeForSession(code)
    Browser.close().catch(() => {})
  })
}
