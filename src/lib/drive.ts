import { db } from '../db'
import { gfetch, gjson } from './googleApi'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const FOLDER_NAME = 'Tokyo'
const FOLDER_KEY = 'tokyo-drive-folder'
const TRASH_KEY = 'tokyo-drive-trash'

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignora */
    }
  },
}

/** Cartella "Tokyo" su Drive (creata dall'app al primo utilizzo) */
async function folderId(): Promise<string> {
  const cached = ls.get(FOLDER_KEY)
  if (cached) return cached
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`)
  const found = await gjson<{ files: { id: string }[] }>(`${API}/files?q=${q}&fields=files(id)&spaces=drive`)
  let id = found.files[0]?.id
  if (!id) {
    const created = await gjson<{ id: string }>(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
    })
    id = created.id
  }
  ls.set(FOLDER_KEY, id)
  return id
}

async function upload(name: string, type: string, blob: Blob): Promise<string> {
  const parent = await folderId()
  const boundary = `tokyo${Date.now()}`
  const meta = JSON.stringify({ name, parents: [parent], mimeType: type || 'application/octet-stream' })
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: ${type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ])
  const res = await gjson<{ id: string }>(UPLOAD, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return res.id
}

/** Scarica un allegato da Drive e lo tiene in cache sul dispositivo */
export async function downloadAttachment(id: string): Promise<Blob> {
  const a = await db.attachments.get(id)
  if (!a?.driveId) throw new Error('Allegato non disponibile')
  const res = await gfetch(`${API}/files/${a.driveId}?alt=media`)
  if (!res.ok) throw new Error(`Download non riuscito (${res.status})`)
  const blob = await res.blob()
  await db.attachments.update(id, { blob })
  return blob
}

/** File da spostare nel cestino di Drive (allegati eliminati su questo dispositivo) */
export function queueTrash(driveId: string) {
  const list: string[] = JSON.parse(ls.get(TRASH_KEY) ?? '[]')
  ls.set(TRASH_KEY, JSON.stringify([...list, driveId]))
}

/** Numero di operazioni Drive in attesa */
export async function pendingDriveWork(): Promise<number> {
  const toUpload = await db.attachments.filter((a) => !!a.blob && !a.driveId).count()
  const toTrash = (JSON.parse(ls.get(TRASH_KEY) ?? '[]') as string[]).length
  const toRename = await db.attachments.filter((a) => !!a.driveId && !!a.driveName && a.driveName !== a.name).count()
  return toUpload + toTrash + toRename
}

/** Carica gli allegati nuovi e cestina quelli eliminati */
export async function syncDrive() {
  const toUpload = await db.attachments.filter((a) => !!a.blob && !a.driveId).toArray()
  for (const a of toUpload) {
    const driveId = await upload(a.name, a.type, a.blob!)
    await db.attachments.update(a.id, { driveId, driveName: a.name })
  }
  // file rinominati nell'app: stesso nome anche su Drive
  const toRename = await db.attachments.filter((a) => !!a.driveId && !!a.driveName && a.driveName !== a.name).toArray()
  for (const a of toRename) {
    const res = await gfetch(`${API}/files/${a.driveId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: a.name }),
    })
    if (!res.ok && res.status !== 404) throw new Error(`Drive ${res.status}`)
    await db.attachments.update(a.id, { driveName: a.name })
  }
  const trash: string[] = JSON.parse(ls.get(TRASH_KEY) ?? '[]')
  while (trash.length) {
    const id = trash[0]
    const res = await gfetch(`${API}/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
    if (!res.ok && res.status !== 404) throw new Error(`Drive ${res.status}`)
    trash.shift()
    ls.set(TRASH_KEY, JSON.stringify(trash))
  }
}
