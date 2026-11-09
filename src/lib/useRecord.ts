import { useEffect, useState } from 'react'
import type { Table } from 'dexie'

/**
 * Carica un record da modificare (una sola volta) oppure restituisce `null`
 * se si sta creando un nuovo elemento. `undefined` = caricamento in corso.
 */
export function useRecord<T>(table: Table<T, string>, id: string | undefined): T | null | undefined {
  const isNew = !id || id === 'nuovo'
  const [rec, setRec] = useState<T | null | undefined>(isNew ? null : undefined)
  useEffect(() => {
    if (isNew) return setRec(null)
    let alive = true
    table.get(id).then((r) => alive && setRec(r ?? null))
    return () => {
      alive = false
    }
  }, [table, id, isNew])
  return rec
}
