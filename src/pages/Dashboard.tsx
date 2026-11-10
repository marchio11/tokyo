import { useLiveQuery } from 'dexie-react-hooks'
import { db, getProfile, type Illness } from '../db'
import { ageLabel, daysBetween, formatDate, todayISO } from '../lib/dates'
import { allReminders } from '../lib/reminders'
import { ReminderCard } from '../components/ReminderCard'
import { navigate } from '../lib/router'
import { medColor } from './Medications'
import { fmtKg } from './Weights'
import { Card, Loading, SectionTitle } from '../components/ui'

export function moodFor(days: number) {
  if (days > 50) return { emoji: '😊', color: '#22c55e' }
  if (days > 20) return { emoji: '😐', color: '#eab308' }
  return { emoji: '😟', color: '#ef4444' }
}

interface Counter {
  category: string
  last?: Illness
  days?: number
  ongoing: boolean
}

export function Dashboard() {
  const data = useLiveQuery(async () => ({
    profile: await getProfile(),
    illnesses: await db.illnesses.toArray(),
    medications: await db.medications.toArray(),
    foods: await db.foods.toArray(),
    visits: await db.visits.orderBy('date').toArray(),
    lastWeight: await db.weights.orderBy('date').last(),
    counts: {
      visits: await db.visits.count(),
      illnesses: await db.illnesses.count(),
      medications: await db.medications.count(),
      foods: await db.foods.count(),
      weights: await db.weights.count(),
    },
  }))
  if (!data) return <Loading />

  const today = todayISO()
  const { profile, illnesses, medications, foods, visits, lastWeight, counts } = data

  // Un contatore per ogni disturbo scelto nella scheda di Tokyo
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  const counters: Counter[] = profile.illnessCategories.map((category) => {
    const eps = illnesses.filter((i) => same(i.category, category))
    const ongoing = eps.some((e) => !e.endDate && e.startDate <= today)
    const last = eps.sort((a, b) => (b.endDate ?? '9999').localeCompare(a.endDate ?? '9999'))[0]
    return { category, last, ongoing, days: last?.endDate ? Math.max(0, daysBetween(last.endDate, today)) : undefined }
  })
  // prima gli episodi in corso, poi i più recenti, in fondo quelli mai registrati
  counters.sort((a, b) => Number(b.ongoing) - Number(a.ongoing) || (a.days ?? 1e9) - (b.days ?? 1e9))

  const reminders = allReminders(medications, visits).filter((r) => r.daysLeft <= 30)
  const activeMeds = medications.filter((m) => m.startDate <= today && (!m.endDate || m.endDate >= today))
  const activeFoods = foods.filter((f) => f.startDate <= today && (!f.endDate || f.endDate >= today))
  const nextVisit = visits.find((v) => v.date > today)

  return (
    <div className="mx-auto max-w-2xl px-4 pt-[max(env(safe-area-inset-top),16px)] pb-44">
      <header className="mb-4 flex items-center gap-3 py-2">
        <img src="icon-192.png" alt="" className="size-12 rounded-2xl" />
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="text-shiba">{profile.name}</span>
          </h1>
          <p className="text-sm text-muted">
            {profile.breed}
            {profile.birthDate ? ` · ${ageLabel(profile.birthDate)}` : ''}
          </p>
        </div>
      </header>

      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">Giorni senza…</h2>
          <button className="text-xs text-shiba" onClick={() => navigate('/malattie/nuovo')}>
            + episodio
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {counters.map((c) => (
            <CounterTile key={c.category} c={c} />
          ))}
        </div>
      </Card>

      {reminders.length > 0 && (
        <>
          <SectionTitle>Promemoria</SectionTitle>
          <div className="space-y-2">
            {reminders.map((r) => (
              <ReminderCard key={r.key} r={r} compact />
            ))}
          </div>
        </>
      )}

      <SectionTitle>Oggi</SectionTitle>
      <Card className="space-y-3">
        <TodayRow icon="💊" label="In corso">
          {activeMeds.length ? (
            <div className="flex flex-wrap gap-1.5">
              {activeMeds.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/farmaci/${m.id}`)}
                  className="rounded-full px-2.5 py-0.5 text-sm"
                  style={{ background: `${medColor(m.kind)}26`, color: medColor(m.kind) }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-muted">Nessun farmaco o integratore</span>
          )}
        </TodayRow>
        <TodayRow icon="🍚" label="Alimentazione">
          {activeFoods.length ? activeFoods.map((f) => f.name).join(', ') : <span className="text-muted">Non indicata</span>}
        </TodayRow>
        <TodayRow icon="🩺" label="Prossima visita">
          {nextVisit ? (
            <>
              {nextVisit.type} · {formatDate(nextVisit.date)}{' '}
              <span className="text-muted">(tra {daysBetween(today, nextVisit.date)} gg)</span>
            </>
          ) : (
            <span className="text-muted">Nessuna in programma</span>
          )}
        </TodayRow>
        <TodayRow icon="⚖️" label="Ultimo peso">
          {lastWeight ? (
            <>
              {fmtKg(lastWeight.kg)} <span className="text-muted">· {formatDate(lastWeight.date)}</span>
            </>
          ) : (
            <span className="text-muted">Nessuna pesata</span>
          )}
        </TodayRow>
      </Card>

      <SectionTitle>Sezioni</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <SectionTile to="/visite" icon="🩺" title="Visite" count={counts.visits} color="#3b82f6" />
        <SectionTile to="/malattie" icon="🤒" title="Malattie" count={counts.illnesses} color="#ef4444" />
        <SectionTile to="/farmaci" icon="💊" title="Farmaci e integratori" count={counts.medications} color="#f97316" />
        <SectionTile to="/cibo" icon="🍚" title="Alimentazione" count={counts.foods} color="#a855f7" />
        <SectionTile to="/peso" icon="⚖️" title="Peso" count={counts.weights} color="#eab308" />
        <SectionTile to="/calendario" icon="📅" title="Calendario" color="#f28c28" />
      </div>
    </div>
  )
}

function CounterTile({ c }: { c: Counter }) {
  const go = () => navigate(c.last ? `/malattie/${c.last.id}` : '/malattie')
  if (c.ongoing)
    return (
      <button onClick={go} className="rounded-xl bg-red-500/10 p-3 text-left ring-1 ring-red-500/40">
        <div className="line-clamp-2 text-sm leading-tight text-[#c9c9d1]">{c.category}</div>
        <div className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-red-400">
          <span className="size-2.5 animate-pulse rounded-full bg-red-500" /> in corso
        </div>
      </button>
    )
  if (c.days === undefined)
    return (
      <button onClick={go} className="rounded-xl bg-card-2 p-3 text-left">
        <div className="line-clamp-2 text-sm leading-tight text-[#c9c9d1]">{c.category}</div>
        <div className="mt-1 text-lg text-muted">mai 🎉</div>
      </button>
    )
  const mood = moodFor(c.days)
  return (
    <button onClick={go} className="rounded-xl bg-card-2 p-3 text-left">
      <div className="line-clamp-2 text-sm leading-tight text-[#c9c9d1]">{c.category}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums" style={{ color: mood.color }}>
          {c.days}
        </span>
        <span className="text-sm text-muted">{c.days === 1 ? 'giorno' : 'giorni'}</span>
        <span className="ml-auto text-2xl">{mood.emoji}</span>
      </div>
    </button>
  )
}

function TodayRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted">{label}</div>
        <div className="text-base">{children}</div>
      </div>
    </div>
  )
}

function SectionTile({ to, icon, title, count, color }: { to: string; icon: string; title: string; count?: number; color: string }) {
  return (
    <button onClick={() => navigate(to)} className="relative overflow-hidden rounded-2xl bg-card p-4 text-left active:bg-card-2">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 leading-tight font-medium">{title}</div>
      {count !== undefined && <div className="text-xs text-muted">{count} {count === 1 ? 'voce' : 'voci'}</div>}
    </button>
  )
}
