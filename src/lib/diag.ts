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
