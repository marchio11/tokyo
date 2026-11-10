import { useLiveQuery } from 'dexie-react-hooks'
import { db, getProfile, newId, type Attachment } from '../db'
import { AttachmentList } from './Attachments'
import { Card } from './ui'

/**
 * Documenti di Tokyo (pedigree, passaggio di proprietà…): si salvano subito,
 * come allegati normali, e finiscono nella cartella "Tokyo" su Google Drive.
 */
export function Documents() {
  const docs = useLiveQuery(async () => {
    const ids = (await getProfile()).documentIds ?? []
    return (await db.attachments.bulkGet(ids)).filter((a): a is Attachment => !!a)
  })

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    const now = Date.now()
    const items: Attachment[] = Array.from(files).map((f) => ({ id: newId(), name: f.name, type: f.type, size: f.size, blob: f, createdAt: now }))
    await db.attachments.bulkAdd(items)
    const p = await getProfile()
    await db.profile.put({ ...p, documentIds: [...(p.documentIds ?? []), ...items.map((i) => i.id)] })
  }

  const remove = async (id: string) => {
    const a = docs?.find((d) => d.id === id)
    if (!confirm(`Eliminare il documento “${a?.name ?? ''}”?`)) return
    const p = await getProfile()
    await db.profile.put({ ...p, documentIds: (p.documentIds ?? []).filter((x) => x !== id) })
    await db.attachments.delete(id)
  }

  return (
    <Card className="space-y-3">
      {docs?.length ? (
        <AttachmentList items={docs} onRemove={remove} showNames />
      ) : (
        <p className="text-sm text-muted">Nessun documento. Puoi allegare pedigree, passaggio di proprietà, libretto sanitario, passaporto…</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm text-muted active:bg-card-2">
          📎 Aggiungi documento
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              add(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm text-muted active:bg-card-2">
          📷 Scatta foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              add(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </Card>
  )
}
