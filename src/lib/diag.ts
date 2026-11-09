import { useSyncExternalStore } from 'react'

/** Raccoglie gli ultimi errori per mostrarli sul telefono (dove la console non è visibile) */
const MAX = 12
let errors: string[] = []
const listeners = new Set<() => void>()

function describe(x: unknown): string {
  if (x instanceof Error) return `${x.name}: ${x.message}`
  if (typeof x === 'object' && x && 'message' in x) return String((x as { message: unknown }).message)
  return String(x)
}

export function logError(...parts: unknown[]) {
  const time = new Date().toLocaleTimeString('it-IT')
  errors = [...errors, `${time} ${parts.map(describe).join(' ')}`].slice(-MAX)
  listeners.forEach((l) => l())
}

export function installDiagnostics() {
  window.addEventListener('error', (e) => logError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => logError('Promise:', e.reason))
  const orig = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    logError(...args)
    orig(...args)
  }
}

export function useErrors(): string[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => errors,
  )
}

// ---------- diagnosi automatica (mostrata quando un caricamento si blocca) ----------

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`nessuna risposta in ${ms / 1000}s`)), ms))])

async function step(label: string, fn: () => Promise<string>): Promise<string> {
  const t0 = performance.now()
  try {
    const res = await withTimeout(fn(), 3000)
    return `✅ ${label}: ${res} (${Math.round(performance.now() - t0)} ms)`
  } catch (e) {
    return `❌ ${label}: ${(e as Error).message ?? e}`
  }
}

/** Controlla database locale, Firebase e permessi, e restituisce un rapporto leggibile */
export async function runDiagnostics(onUpdate: (lines: string[]) => void = () => {}): Promise<string[]> {
  const { db } = await import('../db')
  const { auth, fs } = await import('./firebase')
  const { doc, getDocFromServer } = await import('firebase/firestore')
  const lines: string[] = [`Versione ${__APP_VERSION__} · ${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] ?? ''}`]
  const out = {
    push: (l: string) => {
      lines.push(l)
      onUpdate([...lines])
    },
  }
  onUpdate([...lines])
  out.push(
    await step('Elenco database', async () => {
      const list = (await indexedDB.databases?.()) ?? []
      return list.map((d) => `${d.name}@${d.version}`).join(', ') || 'nessuno'
    }),
  )
  out.push(
    await step('Apertura diretta database "tokyo"', () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('tokyo')
        req.onsuccess = () => {
          const v = req.result.version
          req.result.close()
          resolve(`ok, versione ${v}`)
        }
        req.onerror = () => reject(req.error)
        req.onblocked = () => reject(new Error('bloccato da un’altra connessione'))
      }),
    ),
  )
  out.push(`ℹ️ Dexie: aperto=${db.isOpen()} fallito=${db.hasFailed()} chiuso=${db.hasBeenClosed()}`)
  out.push(await step('Lettura pesate (Dexie)', async () => `${await db.weights.count()} record`))
  out.push(await step('Lettura scheda (Dexie)', async () => ((await db.profile.get('tokyo')) ? 'presente' : 'assente')))
  const user = auth.currentUser
  out.push(`ℹ️ Utente: ${user ? user.email : 'non collegato'}`)
  if (user)
    out.push(
      await step('Firestore (server)', async () => {
        await getDocFromServer(doc(fs, 'users', user.uid, 'meta', 'calendar'))
        return 'accesso consentito'
      }),
    )
  return lines
}

/** Svuota i dati locali (il cloud resta intatto) e ricarica l'app */
export async function resetLocalData() {
  const { db } = await import('../db')
  const { fs } = await import('./firebase')
  const { terminate } = await import('firebase/firestore')
  db.close()
  await terminate(fs).catch(() => undefined)
  const names = ((await indexedDB.databases?.()) ?? []).map((d) => d.name).filter((n): n is string => !!n)
  if (!names.includes('tokyo')) names.push('tokyo')
  let blocked = false
  await Promise.all(
    names.map(
      (n) =>
        new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(n)
          req.onsuccess = req.onerror = () => resolve()
          req.onblocked = () => {
            blocked = true
            resolve()
          }
        }),
    ),
  )
  if (blocked)
    alert(
      'Il database è ancora usato da un’altra copia dell’app (una scheda di Chrome o l’app installata). ' +
        'Chiudi tutte le copie dalle app recenti (o forza l’arresto di Chrome) e riapri l’app.',
    )
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('tokyo-uploaded-'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignora */
  }
  location.reload()
}

const NOSYNC_KEY = 'tokyo-nosync'
export function syncDisabled() {
  try {
    return localStorage.getItem(NOSYNC_KEY) === '1'
  } catch {
    return false
  }
}
export function setSyncDisabled(off: boolean) {
  try {
    if (off) localStorage.setItem(NOSYNC_KEY, '1')
    else localStorage.removeItem(NOSYNC_KEY)
  } catch {
    /* ignora */
  }
  location.reload()
}
