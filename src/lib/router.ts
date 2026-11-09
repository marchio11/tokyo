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
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export const navigate = (path: string) => {
  location.hash = path
}

export const goBack = (fallback = '/') => {
  if (history.length > 1) history.back()
  else navigate(fallback)
}
