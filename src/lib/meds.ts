import type { ISODate, Medication, MedKind } from '../db'
import { formatDate, periodLabel } from './dates'

/**
 * Gli antiparassitari sono singole somministrazioni da ripetere (es. una compressa al mese),
 * non cicli con un inizio e una fine.
 */
export const isSingleDose = (m: { kind: MedKind }) => m.kind === 'antiparassitario'

/** Fine effettiva: una singola somministrazione dura un giorno */
export const medEnd = (m: Pick<Medication, 'kind' | 'startDate' | 'endDate'>): ISODate | undefined =>
  isSingleDose(m) ? (m.endDate ?? m.startDate) : m.endDate

/** Data da cui si calcola il promemoria: la somministrazione oppure la fine del ciclo */
export const reminderBase = (m: Pick<Medication, 'kind' | 'startDate' | 'endDate'>): ISODate | undefined =>
  isSingleDose(m) ? m.startDate : m.endDate

/** "il 14 nov 2026" per una somministrazione, "1 set → 30 set" per un ciclo */
export const medPeriod = (m: Pick<Medication, 'kind' | 'startDate' | 'endDate'>) =>
  isSingleDose(m) ? `il ${formatDate(m.startDate)}` : periodLabel(m.startDate, m.endDate)

/** In corso oggi? */
export const medActiveOn = (m: Pick<Medication, 'kind' | 'startDate' | 'endDate'>, day: ISODate) => {
  const end = medEnd(m)
  return m.startDate <= day && (!end || end >= day)
}
