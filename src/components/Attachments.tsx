import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Attachment } from '../db'
import { downloadAttachment } from '../lib/drive'
import { currentToken, renewToken } from '../lib/firebase'

interface Item {
  id: string
  name: string
  type: string
  size: number
  blob?: Blob
  driveId?: string
  pending?: boolean
}

/**
 * Gestisce gli allegati di un form: i nuovi file restano "in sospeso"
 * finché non si preme Salva (commit), così annullando non restano file orfani.
 */
export function useAttachments(initialIds: string[] | undefined) {
  const [ids, setIds] = useState<string[] | null>(null)
  const [pending, setPending] = useState<Item[]>([])
  const [removed, setRemoved] = useState<string[]>([])

  useEffect(() => {
    if (initialIds && ids === null) setIds(initialIds)
  }, [initialIds, ids])

  const saved = useLiveQuery(async () => {
    const list = await db.attachments.bulkGet(ids ?? [])
    return list.filter((a): a is Attachment => !!a)
  }, [ids])

  const items: Item[] = useMemo(
    () => [...(saved ?? []).filter((a) => !removed.includes(a.id)), ...pending],
    [saved, removed, pending],
  )

  const add = (files: FileList | null) => {
    if (!files) return
    const next = Array.from(files).map((f) => ({ id: newId(), name: f.name, type: f.type, size: f.size, blob: f, pending: true }))
    setPending((p) => [...p, ...next])
  }

  const remove = (id: string) => {
    if (pending.some((p) => p.id === id)) setPending((p) => p.filter((x) => x.id !== id))
    else setRemoved((r) => [...r, id])
  }

  /** Salva i nuovi allegati, elimina quelli rimossi e restituisce gli id finali */
  const commit = async (): Promise<string[]> => {
    const now = Date.now()
    await db.attachments.bulkAdd(pending.map(({ pending: _p, ...a }) => ({ ...a, createdAt: now })))
    await db.attachments.bulkDelete(removed)
    return items.map((i) => i.id)
  }

  return { items, add, remove, commit }
}

export function AttachmentsField({ state }: { state: ReturnType<typeof useAttachments> }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm text-muted">Allegati</span>
      <AttachmentList items={state.items} onRemove={state.remove} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm text-muted active:bg-card">
          📎 Aggiungi file
          <input type="file" multiple accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={(e) => state.add(e.target.files)} />
        </label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm text-muted active:bg-card">
          📷 Scatta foto
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => state.add(e.target.files)} />
        </label>
      </div>
    </div>
  )
}

/** Elenco allegati in sola lettura (o con rimozione) */
export function AttachmentList({ items, onRemove }: { items: Item[]; onRemove?: (id: string) => void }) {
  const [viewer, setViewer] = useState<Item | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  if (!items.length) return null

  const open = async (a: Item) => {
    let blob = a.blob
    if (!blob) {
      // non ancora sul dispositivo: si scarica da Google Drive
      setLoading(a.id)
      try {
        if (!currentToken()) await renewToken()
        blob = await downloadAttachment(a.id)
      } catch (e) {
        alert(`Impossibile aprire l’allegato: ${(e as Error).message}`)
        return
      } finally {
        setLoading(null)
      }
    }
    const item = { ...a, blob }
    if (a.type.startsWith('image/')) return setViewer(item)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.target = '_blank'
    link.download = a.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {items.map((a) => (
          <div key={a.id} className="relative">
            <button type="button" onClick={() => open(a)} className="block w-full overflow-hidden rounded-xl bg-card-2">
              {a.type.startsWith('image/') && a.blob ? (
                <BlobImage blob={a.blob} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-1 p-2">
                  <span className="text-3xl">
                    {loading === a.id ? '⏳' : !a.blob ? '☁️' : a.type === 'application/pdf' ? '📄' : '📁'}
                  </span>
                  <span className="line-clamp-2 text-center text-[11px] break-all text-muted">{a.name}</span>
                </div>
              )}
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-red-500 text-sm text-white"
                aria-label="Rimuovi allegato"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {viewer?.blob && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={() => setViewer(null)}>
          <div className="flex items-center justify-between p-4 pt-[max(env(safe-area-inset-top),16px)]">
            <span className="truncate text-sm text-muted">{viewer.name}</span>
            <button className="text-3xl text-white" aria-label="Chiudi">
              ×
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-2">
            <BlobImage blob={viewer.blob} className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}
    </>
  )
}

function BlobImage({ blob, className }: { blob: Blob; className?: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <img src={url} alt="" className={className} />
}

/** Allegati di un record salvato, in sola lettura */
export function SavedAttachments({ ids }: { ids: string[] }) {
  const items = useLiveQuery(async () => (await db.attachments.bulkGet(ids)).filter((a): a is Attachment => !!a), [ids.join()])
  if (!items?.length) return null
  return <AttachmentList items={items} />
}
