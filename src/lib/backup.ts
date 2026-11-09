import { db, type Attachment } from '../db'
import { todayISO } from './dates'

const TABLES = ['visits', 'illnesses', 'medications', 'foods', 'weights', 'profile'] as const

type SerializedAttachment = Omit<Attachment, 'blob'> & { data?: string }

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function dataURLToBlob(data: string): Promise<Blob> {
  return (await fetch(data)).blob()
}

/** Esporta tutti i dati (allegati inclusi) in un file JSON scaricabile */
export async function exportBackup() {
  const out: Record<string, unknown> = { app: 'tokyo', version: 1, exportedAt: new Date().toISOString() }
  for (const t of TABLES) out[t] = await db[t].toArray()
  const atts = await db.attachments.toArray()
  out.attachments = await Promise.all(
    atts.map(async ({ blob, ...rest }): Promise<SerializedAttachment> => ({ ...rest, data: blob ? await blobToDataURL(blob) : undefined })),
  )
  const file = new Blob([JSON.stringify(out)], { type: 'application/json' })
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = `tokyo-backup-${todayISO()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Ripristina un backup sostituendo tutti i dati attuali */
export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (data.app !== 'tokyo') throw new Error('Il file non sembra un backup di Tokyo')
  const attachments: Attachment[] = await Promise.all(
    ((data.attachments ?? []) as SerializedAttachment[]).map(async ({ data: d, ...rest }) => ({
      ...rest,
      blob: d ? await dataURLToBlob(d) : undefined,
    })),
  )
  await db.transaction('rw', [...TABLES.map((t) => db[t]), db.attachments], async () => {
    for (const t of TABLES) {
      const table = db[t] as unknown as import('dexie').Table<unknown, string>
      // bulkDelete (e non clear) così l'eliminazione arriva anche al cloud
      await table.bulkDelete(await table.toCollection().primaryKeys())
      await table.bulkAdd(data[t] ?? [])
    }
    await db.attachments.bulkDelete(await db.attachments.toCollection().primaryKeys())
    await db.attachments.bulkAdd(attachments)
  })
}
