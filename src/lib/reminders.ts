import type { ISODate, Medication } from '../db'
import { addInterval, daysBetween, todayISO } from './dates'

export interface DueReminder {
  med: Medication
  dueDate: ISODate
  /** giorni mancanti (negativo = scaduto) */
  daysLeft: number
}

/** Data in cui avviare il nuovo ciclo, se il farmaco ha un avviso attivo e una data di fine */
export function reminderDate(med: Medication): ISODate | undefined {
  if (!med.reminder || med.reminder.done || !med.endDate) return undefined
  return addInterval(med.endDate, med.reminder.amount, med.reminder.unit)
}

export function dueReminders(meds: Medication[]): DueReminder[] {
  const today = todayISO()
  return meds
    .map((med) => {
      const dueDate = reminderDate(med)
      return dueDate ? { med, dueDate, daysLeft: daysBetween(today, dueDate) } : undefined
    })
    .filter((r): r is DueReminder => !!r)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function reminderText(daysLeft: number): string {
  if (daysLeft < 0) return `scaduto da ${-daysLeft} ${-daysLeft === 1 ? 'giorno' : 'giorni'}`
  if (daysLeft === 0) return 'oggi'
  if (daysLeft === 1) return 'domani'
  return `tra ${daysLeft} giorni`
}
