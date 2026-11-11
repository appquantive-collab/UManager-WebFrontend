import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/i18n'
// Applies the saved text size / layout before the first render (no size jump on load).
import './lib/display-settings'
import App from './App.tsx'
import { API_BASE_URL } from './lib/api'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The backend sleeps when idle (Render free plan) and takes ~30s to wake.
// Nudge it now, while the visitor is still on the splash, so it's ready sooner.
fetch(API_BASE_URL.replace(/\/api\/?$/, '') + '/health').catch(() => {
  // Purely a wake-up call; failures don't matter.
})

// Only register in production — the dev server serves modules the cache would shadow.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal; the app still works online.
    })
  })
}
