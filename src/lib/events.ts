import type { Food, ISODate, Illness, Medication, Visit, Weight } from '../db'
import { isActiveOn } from './dates'
import { reminderDate, visitReminderDate } from './reminders'

export type EventKind = 'illness' | 'visit' | 'supplement' | 'drug' | 'parasite' | 'food' | 'weight' | 'reminder'

export const EVENT_META: Record<EventKind, { label: string; color: string }> = {
  illness: { label: 'Malattia', color: '#ef4444' },
  visit: { label: 'Visita', color: '#3b82f6' },
  supplement: { label: 'Integratore', color: '#22c55e' },
  drug: { label: 'Farmaco', color: '#f97316' },
  parasite: { label: 'Antiparassitario', color: '#14b8a6' },
  food: { label: 'Cambio cibo', color: '#a855f7' },
  weight: { label: 'Pesata', color: '#eab308' },
  reminder: { label: 'Promemoria', color: '#ec4899' },
}

/** Ordine delle barre nel calendario */
export const KIND_ORDER: EventKind[] = ['illness', 'visit', 'drug', 'supplement', 'parasite', 'food', 'weight', 'reminder']

export interface DayEvent {
  kind: EventKind
  title: string
  detail?: string
  href: string
}

export interface AllData {
  visits: Visit[]
  illnesses: Illness[]
  medications: Medication[]
  foods: Food[]
  weights: Weight[]
}

const medKind = (m: Medication): EventKind => (m.kind === 'farmaco' ? 'drug' : m.kind === 'integratore' ? 'supplement' : 'parasite')

export function eventsOn(day: ISODate, d: AllData): DayEvent[] {
  const out: DayEvent[] = []
  for (const i of d.illnesses)
    if (isActiveOn(day, i.startDate, i.endDate))
      out.push({
        kind: 'illness',
        title: i.category,
        detail: day === i.startDate ? 'inizio episodio' : day === i.endDate ? 'fine episodio' : i.description,
        href: `/malattie/${i.id}`,
      })
  for (const v of d.visits) {
    if (v.date === day) out.push({ kind: 'visit', title: v.type, detail: v.vet, href: `/visite/${v.id}` })
    if (visitReminderDate(v) === day) out.push({ kind: 'reminder', title: `Richiamo: ${v.type}`, href: `/visite/${v.id}` })
  }
  for (const m of d.medications) {
    if (isActiveOn(day, m.startDate, m.endDate))
      out.push({ kind: medKind(m), title: m.name, detail: [m.dosage, m.frequency].filter(Boolean).join(' · ') || undefined, href: `/farmaci/${m.id}` })
    if (reminderDate(m) === day)
      out.push({ kind: 'reminder', title: `Nuovo ciclo: ${m.name}`, href: `/farmaci/${m.id}` })
  }
  for (const f of d.foods)
    if (f.startDate === day) out.push({ kind: 'food', title: `Inizio ${f.name}`, detail: f.kind, href: `/cibo/${f.id}` })
  for (const w of d.weights)
    if (w.date === day) out.push({ kind: 'weight', title: `${w.kg.toLocaleString('it-IT')} kg`, detail: w.notes, href: `/peso/${w.id}` })
  return out.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
}

/** Alimenti in uso in un dato giorno (informativo, senza barra) */
export function foodsOn(day: ISODate, foods: Food[]) {
  return foods.filter((f) => isActiveOn(day, f.startDate, f.endDate))
}
