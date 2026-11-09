import { useSyncExternalStore } from 'react'

/** Stato condiviso della sincronizzazione con Google (Drive + Calendar) */
export interface SyncStatus {
  /** ci sono operazioni Google in attesa ma serve rinnovare l'accesso */
  needsAuth: boolean
  busy: boolean
  error?: string
  /** il calendario "Tokyo" non è stato trovato tra i calendari dell'utente */
  calendarMissing?: boolean
  lastSync?: number
}

let state: SyncStatus = { needsAuth: false, busy: false }
const listeners = new Set<() => void>()

export function setStatus(patch: Partial<SyncStatus>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const getStatus = () => state

export function useStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  )
}
