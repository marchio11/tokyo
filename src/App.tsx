import { useEffect, useState } from 'react'
import { db } from './db'
import { useRoute } from './lib/router'
import { useUser } from './lib/firebase'
import { startSync, stopSync } from './lib/sync'
import { startGoogleSync, stopGoogleSync } from './lib/cloud'
import { SyncBanner } from './components/SyncBanner'
import { setSyncDisabled, syncDisabled } from './lib/diag'
import { LoginPage } from './pages/Login'
import { Loading } from './components/ui'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { VisitsPage } from './pages/Visits'
import { IllnessesPage } from './pages/Illnesses'
import { MedicationsPage } from './pages/Medications'
import { FoodsPage } from './pages/Foods'
import { WeightsPage } from './pages/Weights'
import { CalendarPage } from './pages/CalendarPage'
import { ProfilePage } from './pages/Profile'
import { ReportPage } from './pages/Report'

export default function App() {
  const user = useUser()
  const uid = user?.uid

  const visible = useVisible()

  useEffect(() => {
    // in background l'app libera il database: Android può "congelare" la pagina e una
    // copia congelata con una scrittura in corso bloccherebbe tutte le altre
    if (!visible) {
      db.close({ disableAutoOpen: false })
      return
    }
    if (!uid || syncDisabled()) return
    startSync(uid).catch((e) => console.error('avvio sync', e))
    startGoogleSync()
    return () => {
      stopSync()
      stopGoogleSync()
    }
  }, [uid, visible])

  if (user === undefined) return <Loading />
  if (user === null) return <LoginPage />
  return <Main />
}

function Main() {
  const [section = '', ...rest] = useRoute()
  const id = rest[0]

  let page
  switch (section) {
    case 'visite': page = <VisitsPage key={rest.join('/')} parts={rest} />; break
    case 'malattie': page = <IllnessesPage key={id} id={id} />; break
    case 'farmaci': page = <MedicationsPage key={rest.join('/')} parts={rest} />; break
    case 'cibo': page = <FoodsPage key={id} id={id} />; break
    case 'peso': page = <WeightsPage key={id} id={id} />; break
    case 'calendario': page = <CalendarPage />; break
    case 'scheda': page = <ProfilePage />; break
    case 'riepilogo': page = <ReportPage />; break
    default: page = <Dashboard />
  }

  // la barra in basso evidenzia la scheda principale corrispondente
  const tab = ['calendario', 'peso', 'scheda'].includes(section) ? section : ''
  return (
    <>
      {page}
      <SyncBanner />
      {syncDisabled() && (
        <button
          onClick={() => setSyncDisabled(false)}
          className="fixed top-[max(env(safe-area-inset-top),8px)] right-3 z-50 rounded-full bg-red-500/90 px-3 py-1 text-xs text-white"
        >
          Sincronizzazione disattivata · riattiva
        </button>
      )}
      {/* nei moduli di inserimento/modifica la barra viene nascosta */}
      {!id && section !== 'riepilogo' && <BottomNav current={tab} />}
    </>
  )
}

function useVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden')
    const hide = () => setVisible(false)
    document.addEventListener('visibilitychange', on)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', on)
    return () => {
      document.removeEventListener('visibilitychange', on)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', on)
    }
  }, [])
  return visible
}
