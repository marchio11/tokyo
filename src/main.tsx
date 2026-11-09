import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { installDiagnostics } from './lib/diag'
import './index.css'

installDiagnostics()
registerSW({ immediate: true })

// chiede al browser di non cancellare mai i dati salvati (IndexedDB)
navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
