import type { ISODate, IntervalUnit } from '../db'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISO(new Date())

/** Giorni interi tra due date (b - a), indipendenti da ora legale */
export function daysBetween(a: ISODate, b: ISODate): number {
  const ua = Date.UTC(...ymd(a))
  const ub = Date.UTC(...ymd(b))
  return Math.round((ub - ua) / 86_400_000)
}

function ymd(s: ISODate): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number)
  return [y, m - 1, d]
}

export function addInterval(date: ISODate, amount: number, unit: IntervalUnit): ISODate {
  const d = fromISO(date)
  if (unit === 'giorni') d.setDate(d.getDate() + amount)
  else if (unit === 'settimane') d.setDate(d.getDate() + amount * 7)
  else {
    const months = unit === 'anni' ? amount * 12 : amount
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + months)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(day, last))
  }
  return toISO(d)
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = fromISO(date)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

const fmtShort = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtLong = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const formatDate = (s?: ISODate) => (s ? fmtShort.format(fromISO(s)) : '')
export const formatDateLong = (s: ISODate) => fmtLong.format(fromISO(s))

/** Un intervallo [start, end?] contiene il giorno? (end assente = in corso) */
export function isActiveOn(day: ISODate, start: ISODate, end?: ISODate): boolean {
  if (day < start) return false
  // senza data di fine si considera in corso fino a oggi (non nei giorni futuri)
  return end ? day <= end : day <= todayISO()
}

export function periodLabel(start: ISODate, end?: ISODate): string {
  return end ? `${formatDate(start)} → ${formatDate(end)}` : `dal ${formatDate(start)} · in corso`
}

/** Età leggibile, es. "3 anni e 2 mesi" */
export function ageLabel(birth: ISODate): string {
  const b = fromISO(birth)
  const now = new Date()
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  if (now.getDate() < b.getDate()) months--
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts = []
  if (y) parts.push(`${y} ${y === 1 ? 'anno' : 'anni'}`)
  if (m) parts.push(`${m} ${m === 1 ? 'mese' : 'mesi'}`)
  return parts.join(' e ') || 'meno di un mese'
}
