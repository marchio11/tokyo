import { db, type ISODate, type Medication, type Visit } from '../db'
import { addInterval, daysBetween, todayISO } from './dates'

/** Data in cui avviare il nuovo ciclo, se il farmaco ha un avviso attivo e una data di fine */
export function reminderDate(med: Medication): ISODate | undefined {
  if (!med.reminder || med.reminder.done || !med.endDate) return undefined
  return addInterval(med.endDate, med.reminder.amount, med.reminder.unit)
}

/** Data del richiamo di una visita (es. vaccino), se il promemoria è attivo */
export function visitReminderDate(v: Visit): ISODate | undefined {
  if (!v.reminder || v.reminder.done) return undefined
  return addInterval(v.date, v.reminder.amount, v.reminder.unit)
}

export interface DueReminder {
  key: string
  kind: 'med' | 'visit'
  id: string
  title: string
  icon: string
  dueDate: ISODate
  /** giorni mancanti (negativo = scaduto) */
  daysLeft: number
  /** pagina per registrare il nuovo ciclo / la nuova visita già compilata */
  startHref: string
  startLabel: string
}

export function allReminders(meds: Medication[], visits: Visit[] = []): DueReminder[] {
  const today = todayISO()
  const out: DueReminder[] = []
  for (const m of meds) {
    const dueDate = reminderDate(m)
    if (dueDate)
      out.push({
        key: `m${m.id}`,
        kind: 'med',
        id: m.id,
        title: `Nuovo ciclo: ${m.name}`,
        icon: '🔔',
        dueDate,
        daysLeft: daysBetween(today, dueDate),
        startHref: `/farmaci/nuovo/da/${m.id}`,
        startLabel: 'Avvia ciclo',
      })
  }
  for (const v of visits) {
    const dueDate = visitReminderDate(v)
    if (dueDate)
      out.push({
        key: `v${v.id}`,
        kind: 'visit',
        id: v.id,
        title: `Richiamo: ${v.type}`,
        icon: '💉',
        dueDate,
        daysLeft: daysBetween(today, dueDate),
        startHref: `/visite/${v.id}`,
        startLabel: '',
      })
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/** Archivia un promemoria (non comparirà più tra quelli in arrivo) */
export async function archiveReminder(r: DueReminder) {
  if (r.kind === 'med') {
    const m = await db.medications.get(r.id)
    if (m?.reminder) await db.medications.update(r.id, { reminder: { ...m.reminder, done: true } })
  } else {
    const v = await db.visits.get(r.id)
    if (v?.reminder) await db.visits.update(r.id, { reminder: { ...v.reminder, done: true } })
  }
}

export function reminderText(daysLeft: number): string {
  if (daysLeft < 0) return `scaduto da ${-daysLeft} ${-daysLeft === 1 ? 'giorno' : 'giorni'}`
  if (daysLeft === 0) return 'oggi'
  if (daysLeft === 1) return 'domani'
  return `tra ${daysLeft} giorni`
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Un nuovo ciclo dello stesso prodotto, iniziato dopo la fine del precedente,
 * completa il promemoria di quel ciclo.
 */
export async function closePreviousCycles(med: Pick<Medication, 'id' | 'name' | 'startDate'>) {
  for (const m of await db.medications.toArray()) {
    if (m.id === med.id || !sameName(m.name, med.name) || !m.reminder || m.reminder.done || !m.endDate || m.endDate > med.startDate) continue
    await db.medications.update(m.id, { reminder: { ...m.reminder, done: true } })
  }
}
