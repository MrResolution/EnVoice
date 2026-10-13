import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { MotionConfig } from 'motion/react'
import './index.css'
import { App } from './App'
import { AuthProvider } from './lib/auth'
import { listenForNativeLogin } from './lib/oauth'
import { ToastProvider } from './ui/motion'

listenForNativeLogin()

// HashRouter: works from the Capacitor WebView and on static hosting without rewrites.
// reducedMotion="user": people who turn animations off in their OS settings get none.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </HashRouter>
    </MotionConfig>
  </StrictMode>,
)
