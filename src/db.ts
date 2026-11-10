import Dexie, { type Table } from 'dexie'

/** Date sempre salvate come stringa locale 'YYYY-MM-DD' */
export type ISODate = string

export interface Visit {
  id: string
  date: ISODate
  /** ora 'HH:MM' delle prime versioni dell'app: non più usata */
  time?: string
  /** episodio di malattia per cui è stata fatta la visita */
  illnessId?: string
  type: string
  vet?: string
  notes?: string
  /** promemoria per il richiamo / la visita successiva, calcolato dalla data della visita */
  reminder?: Reminder
  attachmentIds: string[]
  createdAt: number
}

export type Severity = 'lieve' | 'media' | 'forte'

export interface Illness {
  id: string
  category: string
  description?: string
  startDate: ISODate
  endDate?: ISODate
  severity?: Severity
  notes?: string
  attachmentIds: string[]
  createdAt: number
}

export type MedKind = 'farmaco' | 'integratore' | 'antiparassitario'
export type IntervalUnit = 'giorni' | 'settimane' | 'mesi' | 'anni'

export interface Reminder {
  amount: number
  unit: IntervalUnit
  /** true quando il nuovo ciclo è stato avviato o l'avviso è stato archiviato */
  done?: boolean
}

export interface Medication {
  id: string
  kind: MedKind
  name: string
  dosage?: string
  frequency?: string
  startDate: ISODate
  endDate?: ISODate
  notes?: string
  reminder?: Reminder
  /** visita in cui è stato prescritto */
  visitId?: string
  /** episodio di malattia per cui è stato dato */
  illnessId?: string
  attachmentIds: string[]
  createdAt: number
}

export type FoodKind = 'crocchette' | 'umido' | 'snack' | 'altro'

export interface Food {
  id: string
  kind: FoodKind
  name: string
  startDate: ISODate
  endDate?: ISODate
  notes?: string
  createdAt: number
}

export interface Weight {
  id: string
  date: ISODate
  kg: number
  notes?: string
  createdAt: number
}

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  /** contenuto in cache sul dispositivo (assente se non ancora scaricato da Drive) */
  blob?: Blob
  /** id del file su Google Drive, una volta caricato */
  driveId?: string
  /** nome del file su Drive, se diverso da `name` va rinominato */
  driveName?: string
  createdAt: number
}

export interface Profile {
  id: 'tokyo'
  name: string
  breed: string
  sex?: string
  birthDate?: ISODate
  microchip?: string
  allergies?: string
  vetName?: string
  vetPhone?: string
  notes?: string
  /** disturbi con il contatore "giorni senza…" in dashboard */
  illnessCategories: string[]
  /** disturbi proposti come suggerimento nell'inserimento di un episodio */
  illnessSuggestions?: string[]
  visitTypes: string[]
  /** documenti di Tokyo (pedigree, passaggio di proprietà…): id degli allegati */
  documentIds?: string[]
}

const DEFAULT_ILLNESS_SUGGESTIONS = ['Otite', 'Diarrea', 'Vomito', 'Dermatite', 'Ghiandole perianali']

/** Disturbi suggeriti: quelli scelti nella scheda, oppure i predefiniti */
export const illnessSuggestions = (p: Profile) =>
  p.illnessSuggestions ?? [...new Set([...DEFAULT_ILLNESS_SUGGESTIONS, ...p.illnessCategories])]

export const DEFAULT_PROFILE: Profile = {
  id: 'tokyo',
  name: 'Tokyo',
  breed: 'Shiba Inu',
  illnessCategories: ['Otite', 'Diarrea', 'Vomito', 'Dermatite'],
  visitTypes: ['Controllo', 'Dermatologica', 'Esami del sangue', 'Vaccino', 'Urgenza', 'Specialistica'],
}

export const db = new Dexie('tokyo') as Dexie & {
  visits: Table<Visit, string>
  illnesses: Table<Illness, string>
  medications: Table<Medication, string>
  foods: Table<Food, string>
  weights: Table<Weight, string>
  attachments: Table<Attachment, string>
  profile: Table<Profile, string>
}

db.version(1).stores({
  visits: 'id, date',
  illnesses: 'id, startDate, category',
  medications: 'id, startDate, kind',
  foods: 'id, startDate',
  weights: 'id, date',
  attachments: 'id',
  profile: 'id',
})

export const newId = () => crypto.randomUUID()

export async function getProfile(): Promise<Profile> {
  return (await db.profile.get('tokyo')) ?? DEFAULT_PROFILE
}

/** Elimina un record e i suoi allegati */
export async function deleteWithAttachments(
  table: 'visits' | 'illnesses' | 'medications',
  id: string,
) {
  await db.transaction('rw', db[table], db.attachments, async () => {
    const rec = await db[table].get(id)
    if (rec) await db.attachments.bulkDelete(rec.attachmentIds)
    await db[table].delete(id)
  })
}
