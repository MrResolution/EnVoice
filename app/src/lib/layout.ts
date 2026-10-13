// One codebase, two interfaces: the Android app and phone browsers get the mobile app; laptops get the web
// interface (landing page, sidebar dashboards). The APK is always mobile, even on a tablet.
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

const QUERY = '(min-width: 768px)'
const native = Capacitor.isNativePlatform()
const now = () => !native && typeof window !== 'undefined' && window.matchMedia(QUERY).matches

export function useDesktop() {
  const [desktop, setDesktop] = useState(now)
  useEffect(() => {
    if (native) return
    const mq = window.matchMedia(QUERY)
    const on = () => setDesktop(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}
