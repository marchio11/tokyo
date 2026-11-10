import Dexie, { type Table, type Transaction } from 'dexie'
import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, writeBatch, type QuerySnapshot } from 'firebase/firestore'
import { db } from '../db'
import { fs } from './firebase'
import { queueTrash } from './drive'

/**
 * Sincronizzazione Dexie (dati sul dispositivo) ⇄ Firestore (cloud).
 * L'interfaccia continua a leggere/scrivere su Dexie; ogni modifica locale
 * viene inviata a Firestore e ogni modifica remota viene applicata a Dexie.
 * Percorso remoto: users/{uid}/{collezione}/{id}
 */
export const SYNCED = ['visits', 'illnesses', 'medications', 'foods', 'weights', 'attachments', 'profile'] as const
type Coll = (typeof SYNCED)[number]

const REMOTE = '__fromRemote'
let uid: string | null = null
let unsubs: (() => void)[] = []
let hooksInstalled = false

/**
 * Voci scritte / eliminate su questo dispositivo e non ancora confermate dal cloud
 * (chiave "collezione/id"). Il riallineamento all'avvio non deve toccarle: una voce
 * appena creata non è "eliminata altrove", è solo ancora in viaggio verso il cloud.
 */
const unconfirmed = new Set<string>()
const deletedHere = new Set<string>()
const keyOf = (c: Coll, id: string) => `${c}/${id}`

const tbl = (c: Coll) => db[c] as unknown as Table<Record<string, unknown> & { id: string }, string>
const ref = (c: Coll, id: string) => doc(fs, 'users', uid!, c, id)

/** Rimuove i campi che non vanno nel cloud (il contenuto degli allegati sta su Drive) */
function toRemote(c: Coll, obj: Record<string, unknown>) {
  if (c !== 'attachments') return obj
  const { blob: _b, ...rest } = obj
  return rest
}

const isRemote = (t: Transaction | undefined) => !!(t as unknown as Record<string, unknown> | undefined)?.[REMOTE]

/**
 * Le chiamate a Firestore partono fuori dalla transazione di Dexie (setTimeout):
 * mescolare le due librerie nella stessa transazione può bloccare il database locale.
 */
function outsideTransaction(fn: () => void) {
  Dexie.ignoreTransaction(() => setTimeout(fn, 0))
}

function push(c: Coll, obj: Record<string, unknown> & { id: string }) {
  const key = keyOf(c, obj.id)
  unconfirmed.add(key)
  deletedHere.delete(key)
  if (!uid) return
  const data = toRemote(c, { ...obj })
  outsideTransaction(() => {
    if (!uid) return
    setDoc(ref(c, obj.id), data)
      .then(() => unconfirmed.delete(key))
      .catch((e) => console.error('Invio al cloud non riuscito', c, e))
  })
}

function pushDelete(c: Coll, id: string) {
  const key = keyOf(c, id)
  unconfirmed.delete(key)
  deletedHere.add(key)
  if (!uid) return
  outsideTransaction(() => {
    if (!uid) return
    deleteDoc(ref(c, id))
      .then(() => deletedHere.delete(key))
      .catch((e) => console.error('Eliminazione nel cloud non riuscita', c, e))
  })
}

function installHooks() {
  if (hooksInstalled) return
  hooksInstalled = true
  for (const c of SYNCED) {
    const t = tbl(c)
    t.hook('creating', function (_key, obj, trans) {
      if (isRemote(trans)) return
      this.onsuccess = () => push(c, obj)
    })
    t.hook('updating', function (_mods, _key, _obj, trans) {
      if (isRemote(trans)) return
      this.onsuccess = (updated) => push(c, updated as Record<string, unknown> & { id: string })
    })
    t.hook('deleting', function (key, obj, trans) {
      if (isRemote(trans)) return
      const driveId = c === 'attachments' ? (obj as { driveId?: string }).driveId : undefined
      this.onsuccess = () => {
        pushDelete(c, key as string)
        if (driveId) queueTrash(driveId)
      }
    })
  }
}

/** Applica a Dexie una modifica arrivata dal cloud, senza rimandarla indietro */
async function applyRemote(c: Coll, snap: QuerySnapshot, first: boolean) {
  const t = tbl(c)
  await db.transaction('rw', t, async () => {
    ;(Dexie.currentTransaction as unknown as Record<string, unknown>)[REMOTE] = true
    const changes = first
      ? snap.docs.map((d) => ({ type: 'added' as const, doc: d }))
      : snap.docChanges().map((ch) => ({ type: ch.type, doc: ch.doc }))
    if (first) {
      // al primo caricamento elimina i record locali che non esistono più nel cloud,
      // tranne quelli scritti qui e non ancora confermati (che vengono reinviati)
      const remoteIds = new Set(snap.docs.map((d) => d.id))
      const missing = (await t.toCollection().primaryKeys()).filter((k) => !remoteIds.has(k))
      const stale = missing.filter((k) => !unconfirmed.has(keyOf(c, k)))
      await t.bulkDelete(stale)
      for (const k of missing.filter((k) => unconfirmed.has(keyOf(c, k)))) {
        const rec = await t.get(k)
        if (rec) push(c, rec)
      }
    }
    for (const ch of changes) {
      // eliminata qui ma non ancora nel cloud: non va riportata in vita
      if (deletedHere.has(keyOf(c, ch.doc.id))) {
        if (ch.type !== 'removed') pushDelete(c, ch.doc.id)
        continue
      }
      if (ch.type === 'removed') {
        await t.delete(ch.doc.id)
        continue
      }
      const data = { ...ch.doc.data(), id: ch.doc.id } as Record<string, unknown> & { id: string }
      if (c === 'attachments') {
        const local = await t.get(data.id)
        if (local?.blob) data.blob = local.blob
      }
      await t.put(data)
    }
  })
}

/** Al primo accesso da questo dispositivo carica nel cloud i dati già presenti in locale */
async function uploadLocal() {
  for (const c of SYNCED) {
    const [local, remote] = [await tbl(c).toArray(), await getDocs(collection(fs, 'users', uid!, c))]
    const remoteIds = new Set(remote.docs.map((d) => d.id))
    const missing = local.filter((r) => !remoteIds.has(r.id))
    for (let i = 0; i < missing.length; i += 400) {
      const batch = writeBatch(fs)
      missing.slice(i, i + 400).forEach((r) => batch.set(ref(c, r.id), toRemote(c, r)))
      await batch.commit()
    }
  }
}

export async function startSync(userId: string) {
  stopSync()
  uid = userId
  installHooks()
  const flag = `tokyo-uploaded-${userId}`
  let uploaded = false
  try {
    uploaded = !!localStorage.getItem(flag)
  } catch {
    /* ignora */
  }
  if (!uploaded) {
    await uploadLocal()
    try {
      localStorage.setItem(flag, '1')
    } catch {
      /* ignora */
    }
  }
  for (const c of SYNCED) {
    let first = true
    unsubs.push(
      onSnapshot(
        collection(fs, 'users', userId, c),
        (snap) => {
          // il primo snapshot servito solo dalla cache locale potrebbe essere incompleto
          const isFirst = first && !snap.metadata.fromCache
          if (!snap.metadata.fromCache) first = false
          applyRemote(c, snap, isFirst).catch((e) => console.error('Aggiornamento dal cloud non riuscito', c, e))
        },
        (e) => console.error('Lettura dal cloud non riuscita', c, e),
      ),
    )
  }
}

export function stopSync() {
  unsubs.forEach((u) => u())
  unsubs = []
  uid = null
}

export const currentUid = () => uid
