import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, type Medication, type Visit } from '../db'
import { fs } from './firebase'
import { gfetch, gjson } from './googleApi'
import { addDays, todayISO } from './dates'
import { reminderDate } from './reminders'
import { currentUid } from './sync'

/**
 * Sincronizza nel calendario Google "Tokyo":
 *  - le visite (dal momento in cui sono in programma)
 *  - i promemoria per l'avvio di un nuovo ciclo di farmaci/integratori
 * Lo stato degli eventi già creati è salvato in Firestore (users/{uid}/meta/calendar),
 * così telefono e tablet sanno entrambi cosa c'è nel calendario.
 */
const API = 'https://www.googleapis.com/calendar/v3'
const CAL_NAME = 'tokyo'
const CAL_KEY = 'tokyo-calendar-id'
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome'

type EventBody = Record<string, unknown>
type SyncMap = Record<string, string> // eventId → impronta del contenuto

/** Gli id evento Google accettano solo [a-v0-9]: gli UUID esadecimali vanno bene */
const eventId = (prefix: 'vis' | 'rem', id: string) => prefix + id.replace(/-/g, '').toLowerCase()

function visitEvent(v: Visit): EventBody {
  const description = [v.vet && `Veterinario: ${v.vet}`, v.notes].filter(Boolean).join('\n\n')
  if (v.time) {
    const [h, m] = v.time.split(':').map(Number)
    const end = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    return {
      summary: `🩺 Visita: ${v.type}`,
      description,
      start: { dateTime: `${v.date}T${v.time}:00`, timeZone: TZ },
      end: { dateTime: `${v.date}T${end}:00`, timeZone: TZ },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 120 }, { method: 'popup', minutes: 24 * 60 }] },
      status: 'confirmed',
    }
  }
  return {
    summary: `🩺 Visita: ${v.type}`,
    description,
    start: { date: v.date },
    end: { date: addDays(v.date, 1) },
    // per gli eventi di un giorno intero: avviso alle 18 del giorno prima
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 6 * 60 }] },
    status: 'confirmed',
  }
}

function reminderEvent(m: Medication, date: string): EventBody {
  return {
    summary: `🔔 Nuovo ciclo: ${m.name}`,
    description: `Avvia un nuovo ciclo di ${m.name} (${m.kind}).${m.dosage ? `\nDosaggio: ${m.dosage}` : ''}${m.frequency ? `\nFrequenza: ${m.frequency}` : ''}`,
    start: { dateTime: `${date}T09:00:00`, timeZone: TZ },
    end: { dateTime: `${date}T09:15:00`, timeZone: TZ },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    status: 'confirmed',
  }
}

/** Calcola gli eventi che dovrebbero esistere nel calendario */
async function desiredEvents(map: SyncMap): Promise<Map<string, EventBody>> {
  const today = todayISO()
  const out = new Map<string, EventBody>()
  for (const v of await db.visits.toArray()) {
    const id = eventId('vis', v.id)
    // le visite passate restano in calendario solo se erano già state inserite
    if (v.date >= today || id in map) out.set(id, visitEvent(v))
  }
  for (const m of await db.medications.toArray()) {
    if (!m.reminder || !m.endDate) continue
    const id = eventId('rem', m.id)
    const date = reminderDate({ ...m, reminder: { ...m.reminder, done: false } })!
    // un avviso archiviato sparisce se era futuro, resta se era già passato
    if (!m.reminder.done || (id in map && date <= today)) out.set(id, reminderEvent(m, date))
  }
  return out
}

const hash = (e: EventBody) => JSON.stringify(e)
const mapRef = () => doc(fs, 'users', currentUid()!, 'meta', 'calendar')

async function readMap(): Promise<SyncMap> {
  const snap = await getDoc(mapRef())
  return (snap.data()?.events as SyncMap) ?? {}
}

/** Operazioni necessarie per allineare il calendario (senza chiamare Google) */
export async function pendingCalendarWork(): Promise<number> {
  if (!currentUid()) return 0
  const map = await readMap()
  const want = await desiredEvents(map)
  let n = 0
  for (const [id, body] of want) if (map[id] !== hash(body)) n++
  for (const id of Object.keys(map)) if (!want.has(id)) n++
  return n
}

async function calendarId(): Promise<string | null> {
  try {
    const cached = localStorage.getItem(CAL_KEY)
    if (cached) return cached
  } catch {
    /* ignora */
  }
  const list = await gjson<{ items: { id: string; summary: string; summaryOverride?: string }[] }>(
    `${API}/users/me/calendarList?minAccessRole=writer`,
  )
  const cal = list.items.find((c) => [c.summary, c.summaryOverride].some((s) => s?.trim().toLowerCase() === CAL_NAME))
  if (!cal) return null
  try {
    localStorage.setItem(CAL_KEY, cal.id)
  } catch {
    /* ignora */
  }
  return cal.id
}

/** Allinea il calendario "Tokyo". Restituisce false se il calendario non esiste. */
export async function syncCalendar(): Promise<boolean> {
  if (!currentUid()) return true
  const map = await readMap()
  const want = await desiredEvents(map)
  const ops = [...want].filter(([id, b]) => map[id] !== hash(b))
  const removals = Object.keys(map).filter((id) => !want.has(id))
  if (!ops.length && !removals.length) return true

  const cal = await calendarId()
  if (!cal) return false
  const base = `${API}/calendars/${encodeURIComponent(cal)}/events`
  const next = { ...map }
  try {
    for (const [id, body] of ops) {
      const json = { 'Content-Type': 'application/json' }
      let res = await gfetch(`${base}/${id}`, { method: 'PUT', headers: json, body: JSON.stringify(body) })
      if (res.status === 404) res = await gfetch(base, { method: 'POST', headers: json, body: JSON.stringify({ ...body, id }) })
      if (res.status === 404 || res.status === 403) {
        // calendario eliminato o non più accessibile: lo si cercherà di nuovo
        localStorage.removeItem(CAL_KEY)
      }
      if (!res.ok) throw new Error(`Calendar ${res.status}: ${(await res.text()).slice(0, 200)}`)
      next[id] = hash(body)
    }
    for (const id of removals) {
      const res = await gfetch(`${base}/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Calendar ${res.status}`)
      delete next[id]
    }
  } finally {
    await setDoc(mapRef(), { events: next })
  }
  return true
}
