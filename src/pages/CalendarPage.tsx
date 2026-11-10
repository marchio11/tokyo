import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatDateLong, toISO, todayISO } from '../lib/dates'
import { EVENT_META, KIND_ORDER, eventsOn, foodsOn, type AllData, type EventKind } from '../lib/events'
import { navigate } from '../lib/router'
import { Card, Loading, Page } from '../components/ui'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })

export function CalendarPage() {
  const data = useLiveQuery(async (): Promise<AllData> => ({
    visits: await db.visits.toArray(),
    illnesses: await db.illnesses.toArray(),
    medications: await db.medications.toArray(),
    foods: await db.foods.toArray(),
    weights: await db.weights.toArray(),
  }))
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState(todayISO())
  const [adding, setAdding] = useState(false)
  const touchX = useRef<number | null>(null)

  const shift = (delta: number) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1)
    const offset = (first.getDay() + 6) % 7 // lunedì = 0
    const days = new Date(ym.y, ym.m + 1, 0).getDate()
    const total = Math.ceil((offset + days) / 7) * 7
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(ym.y, ym.m, i - offset + 1)
      return { iso: toISO(d), day: d.getDate(), inMonth: d.getMonth() === ym.m }
    })
  }, [ym])

  const kindsByDay = useMemo(() => {
    const map = new Map<string, EventKind[]>()
    if (!data) return map
    for (const c of cells) {
      const kinds = [...new Set(eventsOn(c.iso, data).map((e) => e.kind))]
      map.set(c.iso, kinds)
    }
    return map
  }, [cells, data])

  if (!data) return <Loading />
  const today = todayISO()
  const dayEvents = eventsOn(selected, data)
  const dayFoods = foodsOn(selected, data.foods)

  return (
    <Page
      title="Calendario"
      action={
        <button
          className="rounded-full border border-line px-3 py-1 text-sm text-shiba"
          onClick={() => {
            setYm({ y: now.getFullYear(), m: now.getMonth() })
            setSelected(today)
          }}
        >
          Oggi
        </button>
      }
    >
      <div
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 60) shift(dx < 0 ? 1 : -1)
          touchX.current = null
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <button className="grid size-10 place-items-center rounded-full text-2xl text-muted active:bg-card" onClick={() => shift(-1)} aria-label="Mese precedente">
            ‹
          </button>
          <span className="text-lg font-semibold capitalize">{monthFmt.format(new Date(ym.y, ym.m, 1))}</span>
          <button className="grid size-10 place-items-center rounded-full text-2xl text-muted active:bg-card" onClick={() => shift(1)} aria-label="Mese successivo">
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="pb-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c) => {
            const kinds = kindsByDay.get(c.iso) ?? []
            const isSel = c.iso === selected
            const isToday = c.iso === today
            return (
              <button
                key={c.iso}
                onClick={() => {
                  setSelected(c.iso)
                  if (!c.inMonth) setYm({ y: +c.iso.slice(0, 4), m: +c.iso.slice(5, 7) - 1 })
                }}
                className={`flex h-[4.25rem] flex-col items-stretch rounded-lg px-1 pt-1 pb-1.5 ${
                  isSel ? 'bg-card-2 ring-1 ring-shiba' : 'bg-card'
                } ${c.inMonth ? '' : 'opacity-35'}`}
              >
                <span
                  className={`mx-auto mb-1 grid size-6 place-items-center rounded-full text-[15px] ${
                    isToday ? 'bg-shiba font-semibold text-black' : ''
                  }`}
                >
                  {c.day}
                </span>
                <span className="mt-auto flex flex-col gap-[3px]">
                  {kinds.slice(0, 5).map((k) => (
                    <span key={k} className="h-[4px] rounded-full" style={{ background: EVENT_META[k].color }} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 px-1">
        {KIND_ORDER.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-[4px] w-3.5 rounded-full" style={{ background: EVENT_META[k].color }} />
            {EVENT_META[k].label}
          </span>
        ))}
      </div>

      <h2 className="mt-6 mb-2 px-1 font-semibold capitalize">{formatDateLong(selected)}</h2>
      <div className="space-y-2">
        {dayEvents.length === 0 && <Card className="text-sm text-muted">Nessun evento in questo giorno.</Card>}
        {dayEvents.map((e, i) => (
          <Card key={i} onClick={() => navigate(e.href)}>
            <div className="flex items-center gap-3">
              <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: EVENT_META[e.kind].color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{e.title}</div>
                <div className="truncate text-sm text-muted">
                  {EVENT_META[e.kind].label}
                  {e.detail ? ` · ${e.detail}` : ''}
                </div>
              </div>
              <span className="text-muted">›</span>
            </div>
          </Card>
        ))}
        {dayFoods.length > 0 && (
          <p className="px-1 pt-1 text-sm text-muted">🍚 Alimentazione: {dayFoods.map((f) => f.name).join(', ')}</p>
        )}
      </div>

      <button
        onClick={() => setAdding(true)}
        aria-label="Aggiungi"
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 grid size-14 place-items-center rounded-full bg-shiba text-3xl text-black shadow-lg shadow-shiba/20 active:scale-95"
      >
        +
      </button>
      {adding && <AddSheet date={selected} onClose={() => setAdding(false)} />}
    </Page>
  )
}

const ADD_OPTIONS = [
  { to: '/visite/nuovo', icon: '🩺', label: 'Visita', hint: 'anche futura, con promemoria richiamo', color: '#3b82f6' },
  { to: '/malattie/nuovo', icon: '🤒', label: 'Malattia', hint: 'inizio di un episodio', color: '#ef4444' },
  { to: '/farmaci/nuovo', icon: '💊', label: 'Farmaco o integratore', hint: 'inizio di un ciclo', color: '#f97316' },
  { to: '/cibo/nuovo', icon: '🍚', label: 'Alimentazione', hint: 'cambio di cibo', color: '#a855f7' },
  { to: '/peso/nuovo', icon: '⚖️', label: 'Pesata', hint: '', color: '#eab308' },
]

/** Pannello dal basso per scegliere cosa aggiungere nel giorno selezionato */
function AddSheet({ date, onClose }: { date: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-2xl rounded-t-3xl bg-card px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-1 px-1 font-semibold">Aggiungi</h2>
        <p className="mb-3 px-1 text-sm text-muted capitalize">{formatDateLong(date)}</p>
        <div className="space-y-1.5">
          {ADD_OPTIONS.map((o) => (
            <button
              key={o.to}
              onClick={() => {
                onClose()
                navigate(`${o.to}?data=${date}`)
              }}
              className="flex w-full items-center gap-3 rounded-xl bg-card-2 px-3 py-3 text-left active:bg-line"
            >
              <span className="h-8 w-1 rounded-full" style={{ background: o.color }} />
              <span className="text-xl">{o.icon}</span>
              <span className="flex-1">
                <span className="block font-medium">{o.label}</span>
                {o.hint && <span className="block text-xs text-muted">{o.hint}</span>}
              </span>
              <span className="text-muted">›</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 w-full rounded-xl py-3 text-muted">
          Annulla
        </button>
      </div>
    </div>
  )
}
