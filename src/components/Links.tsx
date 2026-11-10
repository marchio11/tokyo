import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatDate } from '../lib/dates'
import { navigate } from '../lib/router'

/** "🩺 dalla visita del …": rimanda alla visita da cui è nato il record */
export function FromVisit({ visitId, label = 'Prescritto nella visita' }: { visitId?: string; label?: string }) {
  const v = useLiveQuery(() => (visitId ? db.visits.get(visitId) : undefined), [visitId])
  if (!v) return null
  return (
    // span e non button: può stare dentro le righe cliccabili degli elenchi
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/visite/${v.id}`)
      }}
      className="inline-flex cursor-pointer items-center gap-1 text-sm text-ev-visit"
    >
      🩺 {label} del {formatDate(v.date)} ›
    </span>
  )
}

/** "🤒 per … del …": rimanda all'episodio per cui è stato dato il farmaco */
export function ForIllness({ illnessId }: { illnessId?: string }) {
  const i = useLiveQuery(() => (illnessId ? db.illnesses.get(illnessId) : undefined), [illnessId])
  if (!i) return null
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/malattie/${i.id}`)
      }}
      className="inline-flex cursor-pointer items-center gap-1 text-sm text-ev-illness"
    >
      🤒 per {i.category} del {formatDate(i.startDate)} ›
    </span>
  )
}

/** Visite collegate a un episodio (i farmaci sono già nel modulo dell'episodio) */
export function IllnessHistory({ illnessId }: { illnessId: string }) {
  const visits = useLiveQuery(
    async () => (await db.visits.filter((v) => v.illnessId === illnessId).toArray()).sort((a, b) => a.date.localeCompare(b.date)),
    [illnessId],
  )
  if (!visits?.length) return null
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-2 font-medium">🩺 Visite per questo episodio</div>
      <div className="space-y-1.5">
        {visits.map((v) => (
          <Row
            key={v.id}
            color="#3b82f6"
            title={v.type}
            sub={[formatDate(v.date), v.vet].filter(Boolean).join(' · ')}
            onClick={() => navigate(`/visite/${v.id}`)}
          />
        ))}
      </div>
    </div>
  )
}

function Row({ color, title, sub, onClick }: { color: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2 text-left active:bg-card-2">
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <span className="text-muted">›</span>
    </button>
  )
}
