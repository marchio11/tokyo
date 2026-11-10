import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getProfile, newId, type Attachment } from '../db'
import { BlobImage, useOpener } from './Attachments'
import { SectionTitle } from './ui'

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true })

/**
 * Documenti di Tokyo (pedigree, passaggio di proprietà…): elenco in ordine alfabetico,
 * di sola consultazione; con la matita si possono rinominare ed eliminare.
 * Sono allegati normali, quindi finiscono nella cartella "Tokyo" su Google Drive.
 */
export function Documents() {
  const [editing, setEditing] = useState(false)
  const { open, loading, viewerEl } = useOpener()
  const docs = useLiveQuery(async () => {
    const ids = (await getProfile()).documentIds ?? []
    const list = (await db.attachments.bulkGet(ids)).filter((a): a is Attachment => !!a)
    return list.sort((a, b) => collator.compare(a.name, b.name))
  })

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    const now = Date.now()
    const items: Attachment[] = Array.from(files).map((f) => ({ id: newId(), name: f.name, type: f.type, size: f.size, blob: f, createdAt: now }))
    await db.attachments.bulkAdd(items)
    const p = await getProfile()
    await db.profile.put({ ...p, documentIds: [...(p.documentIds ?? []), ...items.map((i) => i.id)] })
  }

  const rename = async (a: Attachment, name: string) => {
    const clean = name.trim()
    if (!clean || clean === a.name) return
    // driveName ricorda il nome attuale su Drive, così il file viene rinominato anche lì
    await db.attachments.update(a.id, { name: clean, driveName: a.driveName ?? a.name })
  }

  const remove = async (a: Attachment) => {
    if (!confirm(`Eliminare “${a.name}”?`)) return
    const p = await getProfile()
    await db.profile.put({ ...p, documentIds: (p.documentIds ?? []).filter((x) => x !== a.id) })
    await db.attachments.delete(a.id)
  }

  return (
    <>
      <SectionTitle
        right={
          docs?.length ? (
            editing ? (
              <button onClick={() => setEditing(false)} className="rounded-full px-3 py-1 text-sm font-semibold text-shiba">
                Fine
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="grid size-9 place-items-center rounded-full bg-card text-shiba active:bg-card-2"
                aria-label="Modifica documenti"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
                  <path d="M13.5 6.5l4 4" />
                </svg>
              </button>
            )
          ) : undefined
        }
      >
        📁 Documenti di Tokyo
      </SectionTitle>

      <div className="rounded-2xl bg-card">
        {docs?.length ? (
          <div className="divide-y divide-line">
            {docs.map((a) =>
              editing ? (
                <div key={a.id} className="flex items-center gap-3 px-4 py-2">
                  <DocIcon a={a} />
                  <input
                    defaultValue={a.name}
                    onBlur={(e) => rename(a, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 outline-none focus:border-shiba"
                    aria-label="Nome del documento"
                  />
                  <button
                    onClick={() => remove(a)}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-muted active:bg-card-2"
                    aria-label={`Elimina ${a.name}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button key={a.id} onClick={() => open(a)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-card-2">
                  <DocIcon a={a} loading={loading === a.id} />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="text-muted">›</span>
                </button>
              ),
            )}
          </div>
        ) : (
          <p className="px-4 pt-4 text-sm text-muted">Nessun documento. Puoi allegare pedigree, passaggio di proprietà, libretto sanitario, passaporto…</p>
        )}
        <div className="grid grid-cols-2 gap-2 p-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm text-muted active:bg-card-2">
            📎 Aggiungi
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
      </div>
      {viewerEl}
    </>
  )
}

/** Icona piccola: miniatura per le foto, simbolo per gli altri file */
function DocIcon({ a, loading }: { a: Attachment; loading?: boolean }) {
  if (loading) return <span className="grid size-9 shrink-0 place-items-center text-xl">⏳</span>
  if (a.type.startsWith('image/') && a.blob) return <BlobImage blob={a.blob} className="size-9 shrink-0 rounded-md object-cover" />
  const icon = a.type === 'application/pdf' ? '📄' : /word|document/.test(a.type) ? '📝' : a.type.startsWith('image/') ? '🖼️' : '📁'
  return <span className="grid size-9 shrink-0 place-items-center text-2xl">{icon}</span>
}
