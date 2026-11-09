import { useEffect } from 'react'
import { useRoute } from './lib/router'
import { useUser } from './lib/firebase'
import { startSync, stopSync } from './lib/sync'
import { startGoogleSync, stopGoogleSync } from './lib/cloud'
import { SyncBanner } from './components/SyncBanner'
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

  useEffect(() => {
    if (!uid) return
    startSync(uid).catch((e) => console.error('avvio sync', e))
    startGoogleSync()
    return () => {
      stopSync()
      stopGoogleSync()
    }
  }, [uid])

  if (user === undefined) return <Loading />
  if (user === null) return <LoginPage />
  return <Main />
}

function Main() {
  const [section = '', ...rest] = useRoute()
  const id = rest[0]

  let page
  switch (section) {
    case 'visite': page = <VisitsPage key={id} id={id} />; break
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
      {/* nei moduli di inserimento/modifica la barra viene nascosta */}
      {!id && section !== 'riepilogo' && <BottomNav current={tab} />}
    </>
  )
}
