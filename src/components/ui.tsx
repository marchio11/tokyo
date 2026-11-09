import { useEffect, useState } from 'react'
import { resetLocalData, runDiagnostics, setSyncDisabled, syncDisabled, useErrors } from '../lib/diag'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { goBack, navigate } from '../lib/router'

export function Page({
  title,
  back,
  action,
  children,
}: {
  title: string
  back?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-44">
      <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 bg-bg/90 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 backdrop-blur">
        {back !== undefined && (
          <button
            onClick={() => goBack(back)}
            className="-ml-2 grid size-10 place-items-center rounded-full text-2xl text-muted active:bg-card"
            aria-label="Indietro"
          >
            ‹
          </button>
        )}
        <h1 className="flex-1 truncate text-xl font-semibold">{title}</h1>
        {action}
      </header>
      {children}
    </div>
  )
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const cls = `rounded-2xl bg-card p-4 ${onClick ? 'cursor-pointer active:bg-card-2 transition-colors' : ''} ${className}`
  return onClick ? (
    <button type="button" onClick={onClick} className={`block w-full text-left ${cls}`}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between px-1">
      <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{children}</h2>
      {right}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-line bg-card px-3 py-2.5 text-[#ececf1] outline-none placeholder:text-muted/60 focus:border-shiba'

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className ?? ''}`} />

export const TextArea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...p} className={`${inputCls} resize-y ${p.className ?? ''}`} />
)

export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${inputCls} ${p.className ?? ''}`} />

export function Button({
  variant = 'primary',
  className = '',
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const v = {
    primary: 'bg-shiba text-black font-semibold active:brightness-90',
    ghost: 'bg-card-2 text-[#ececf1] active:bg-line',
    danger: 'bg-red-500/15 text-red-400 active:bg-red-500/25',
  }[variant]
  return <button type="button" {...p} className={`rounded-xl px-4 py-3 disabled:opacity-40 ${v} ${className}`} />
}

/** Pulsante tondo flottante "+" */
export function Fab({ to, label = 'Aggiungi' }: { to: string; label?: string }) {
  return (
    <button
      onClick={() => navigate(to)}
      aria-label={label}
      className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-30 grid size-14 place-items-center rounded-full bg-shiba text-3xl text-black shadow-lg shadow-shiba/20 active:scale-95"
    >
      +
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">{children}</div>
}

export function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: color ? `${color}26` : 'var(--color-card-2)', color: color ?? 'var(--color-muted)' }}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-sm ${value === o.value ? 'bg-shiba-soft font-semibold text-shiba' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Barra azioni in fondo ai form: Salva + Elimina */
export function FormActions({ onSave, onDelete, canSave = true }: { onSave: () => void; onDelete?: () => void; canSave?: boolean }) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <Button onClick={onSave} disabled={!canSave}>
        Salva
      </Button>
      {onDelete && (
        <Button
          variant="danger"
          onClick={() => {
            if (confirm('Eliminare definitivamente questo elemento?')) onDelete()
          }}
        >
          Elimina
        </Button>
      )}
    </div>
  )
}

export function Loading() {
  // se il caricamento dura troppo mostra gli errori raccolti e un modo per ripartire
  const [slow, setSlow] = useState(false)
  const [report, setReport] = useState<string[] | null>(null)
  const errors = useErrors()
  useEffect(() => {
    const t = setTimeout(() => {
      setSlow(true)
      runDiagnostics(setReport).catch((e) => setReport([`Diagnosi non riuscita: ${e}`]))
    }, 5000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="p-8 text-center text-muted">
      Caricamento…
      {slow && (
        <div className="mt-6 space-y-3 text-left text-sm">
          <p>Ci sta mettendo più del previsto.</p>
          <pre className="max-h-80 overflow-auto rounded-xl bg-card p-3 text-xs whitespace-pre-wrap text-[#c9c9d1] select-text">
            {report ? report.join('\n') : 'Diagnosi in corso…'}
            {errors.length > 0 && '\n\nErrori:\n' + errors.join('\n')}
          </pre>
          <p className="text-xs">Fai uno screenshot di questo riquadro e mandalo a Claude.</p>
          <Button className="w-full" onClick={() => location.reload()}>
            Ricarica l’app
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setSyncDisabled(!syncDisabled())}>
            {syncDisabled() ? 'Riattiva la sincronizzazione' : 'Avvia senza sincronizzazione (prova)'}
          </Button>
          <Button
            variant="danger"
            className="w-full"
            onClick={() =>
              confirm('Svuoto i dati salvati su questo telefono e li riscarico dal cloud. Eventuali dati mai sincronizzati andranno persi. Procedo?') &&
              resetLocalData()
            }
          >
            Ripara: svuota i dati locali
          </Button>
        </div>
      )}
    </div>
  )
}
