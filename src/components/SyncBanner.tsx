import { runGoogleSync } from '../lib/cloud'
import { useStatus } from '../lib/status'

/** Avviso in alto quando Drive/Calendar aspettano un nuovo accesso a Google */
export function SyncBanner() {
  const s = useStatus()
  if (s.needsAuth)
    return (
      <Bar onClick={() => runGoogleSync(true)}>
        {s.busy ? '⏳ Sincronizzazione…' : '🔄 Allegati o calendario da sincronizzare — tocca per collegare Google'}
      </Bar>
    )
  if (s.calendarMissing)
    return (
      <Bar onClick={() => runGoogleSync(true)}>
        📅 Calendario “Tokyo” non trovato nel tuo Google Calendar — crealo e tocca qui per riprovare
      </Bar>
    )
  if (s.error) return <Bar onClick={() => runGoogleSync(true)}>⚠️ Errore di sincronizzazione — tocca per riprovare</Bar>
  return null
}

function Bar({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] left-3 right-[88px] z-30 max-w-xl rounded-xl border border-shiba/40 bg-[#2a1d10] px-4 py-3 text-left text-sm text-[#ffd2a6] shadow-lg"
    >
      {children}
    </button>
  )
}
