import { liveQuery, type Subscription } from 'dexie'
import { db } from '../db'
import { currentToken, onTokenChange, renewToken } from './firebase'
import { AuthNeeded } from './googleApi'
import { pendingDriveWork, syncDrive } from './drive'
import { pendingCalendarWork, syncCalendar } from './gcal'
import { getStatus, setStatus } from './status'

/** Coordina le sincronizzazioni con Google Drive e Google Calendar */
let timer: ReturnType<typeof setTimeout> | undefined
let sub: Subscription | undefined
let offToken: (() => void) | undefined

export async function runGoogleSync(interactive = false) {
  if (getStatus().busy) return
  setStatus({ busy: true, error: undefined })
  try {
    const pending = (await pendingDriveWork()) + (await pendingCalendarWork())
    if (!pending) return setStatus({ needsAuth: false, lastSync: Date.now() })
    if (!currentToken()) {
      if (!interactive) return setStatus({ needsAuth: true })
      if (!(await renewToken())) return setStatus({ needsAuth: true })
    }
    await syncDrive()
    const found = await syncCalendar()
    setStatus({ needsAuth: false, calendarMissing: !found, lastSync: Date.now() })
  } catch (e) {
    if (e instanceof AuthNeeded) setStatus({ needsAuth: true })
    else {
      console.error(e)
      setStatus({ error: (e as Error).message })
    }
  } finally {
    setStatus({ busy: false })
  }
}

export function scheduleGoogleSync(delay = 3000) {
  clearTimeout(timer)
  timer = setTimeout(() => runGoogleSync(false), delay)
}

/** Avvia l'osservazione delle modifiche locali che interessano Drive/Calendar */
export function startGoogleSync() {
  stopGoogleSync()
  let firstRun = true
  sub = liveQuery(async () => {
    // leggere queste tabelle fa ripartire la query a ogni loro modifica
    await db.visits.toArray()
    await db.medications.toArray()
    await db.attachments.count()
    return Date.now()
  }).subscribe(() => {
    scheduleGoogleSync(firstRun ? 1500 : 3000)
    firstRun = false
  })
  offToken = onTokenChange(() => currentToken() && scheduleGoogleSync(200))
  window.addEventListener('online', onOnline)
}

const onOnline = () => scheduleGoogleSync(500)

export function stopGoogleSync() {
  sub?.unsubscribe()
  offToken?.()
  clearTimeout(timer)
  window.removeEventListener('online', onOnline)
}
