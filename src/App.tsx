import { useRoute } from './lib/router'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { VisitsPage } from './pages/Visits'
import { IllnessesPage } from './pages/Illnesses'
import { MedicationsPage } from './pages/Medications'
import { FoodsPage } from './pages/Foods'
import { WeightsPage } from './pages/Weights'
import { CalendarPage } from './pages/CalendarPage'
import { ProfilePage } from './pages/Profile'

export default function App() {
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
    default: page = <Dashboard />
  }

  // la barra in basso evidenzia la scheda principale corrispondente
  const tab = ['calendario', 'peso', 'scheda'].includes(section) ? section : ''
  return (
    <>
      {page}
      {/* nei moduli di inserimento/modifica la barra viene nascosta */}
      {!id && <BottomNav current={tab} />}
    </>
  )
}
