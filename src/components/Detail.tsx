import { useEffect, type ReactNode } from 'react'
import { goBack, navigate } from '../lib/router'
import { Loading, Page } from './ui'

/**
 * Scheda di sola lettura di una voce salvata, con il tasto ✏️ per passare alla modifica.
 * `record` undefined = caricamento, null = voce non più esistente (es. appena eliminata).
 */
export function DetailPage<T>({
  title,
  back,
  editHref,
  record,
  children,
}: {
  title: string
  back: string
  editHref: string
  record: T | null | undefined
  children: (r: T) => ReactNode
}) {
  // voce eliminata dalla modifica: si torna all'elenco
  useEffect(() => {
    if (record === null) goBack(back)
  }, [record, back])
  if (!record) return <Loading />
  return (
    <Page
      title={title}
      back={back}
      action={
        <button
          onClick={() => navigate(editHref)}
          className="-mr-1 grid size-10 shrink-0 place-items-center rounded-full bg-card text-shiba active:bg-card-2"
          aria-label="Modifica"
          title="Modifica"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
            <path d="M13.5 6.5l4 4" />
          </svg>
        </button>
      }
    >
      <div className="space-y-3">{children(record)}</div>
    </Page>
  )
}

/** Riquadro con righe etichetta/valore; le righe vuote non vengono mostrate */
export function DetailCard({ children, accent }: { children: ReactNode; accent?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card px-4 py-1">
      {accent && <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />}
      <div className="divide-y divide-line">{children}</div>
    </div>
  )
}

export function DetailRow({ label, children }: { label: string; children?: ReactNode }) {
  if (children === undefined || children === null || children === '' || children === false) return null
  return (
    <div className="py-3">
      <div className="text-xs tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap">{children}</div>
    </div>
  )
}

/** Titolo di un gruppo nella scheda (es. "Farmaci", "Allegati") */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mt-4 mb-2 px-1 text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>
      {children}
    </div>
  )
}

/** Riga cliccabile verso un'altra voce collegata */
export function LinkRow({ color, title, sub, href }: { color: string; title: string; sub?: string; href: string }) {
  return (
    <button onClick={() => navigate(href)} className="flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left active:bg-card-2">
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
      <span className="text-muted">›</span>
    </button>
  )
}
