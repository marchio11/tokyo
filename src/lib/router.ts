import { useEffect, useState } from 'react'

/** Router minimale basato sull'hash (#/visite/nuovo): funziona su qualsiasi hosting statico */
export function useRoute(): string[] {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const on = () => {
      setHash(location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean)
}

/** Parametro dopo il "?" nell'hash, es. #/visite/nuovo?data=2026-11-20 */
export function routeParam(name: string): string | null {
  const q = location.hash.split('?')[1]
  return q ? new URLSearchParams(q).get(name) : null
}

/** Data proposta per un nuovo elemento (dal calendario) oppure oggi */
export const presetDate = (today: string) => {
  const d = routeParam('data')
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today
}

export const navigate = (path: string) => {
  location.hash = path
}

export const goBack = (fallback = '/') => {
  if (history.length > 1) history.back()
  else navigate(fallback)
}
