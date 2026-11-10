import { useState } from 'react'
import type { Illness, Severity } from '../db'
import { periodLabel, todayISO } from '../lib/dates'
import { ComboInput } from './ComboInput'
import { Card, Field, Input, Segmented } from './ui'

/** Episodio di malattia compilato dentro la visita (nuovo oppure già esistente) */
export interface IllnessDraft {
  /** id dell'episodio esistente; assente = nuovo episodio */
  id?: string
  category: string
  description: string
  startDate: string
  endDate: string
  severity: Severity | ''
}

export const emptyIllness = (date: string): IllnessDraft => ({
  category: '',
  description: '',
  startDate: date,
  endDate: '',
  severity: '',
})

export const illnessToDraft = (i: Illness): IllnessDraft => ({
  id: i.id,
  category: i.category,
  description: i.description ?? '',
  startDate: i.startDate,
  endDate: i.endDate ?? '',
  severity: i.severity ?? '',
})

export const illnessDraftValid = (d: IllnessDraft) => !!d.category.trim() && !!d.startDate && (!d.endDate || d.endDate >= d.startDate)

/** Sezione "Malattia" del modulo visita */
export function VisitIllness({
  value,
  onChange,
  episodes,
  suggestions,
  visitDate,
  linkOnly = false,
}: {
  value: IllnessDraft
  onChange: (d: IllnessDraft) => void
  episodes: Illness[]
  suggestions: string[]
  visitDate: string
  /** solo scelta di un episodio già registrato (visite di altro tipo, es. ecografia) */
  linkOnly?: boolean
}) {
  const [mode, setMode] = useState<'new' | 'existing'>(linkOnly || value.id ? 'existing' : 'new')
  const [open, setOpen] = useState(linkOnly && !value.id)
  const [filter, setFilter] = useState('')
  const set = <K extends keyof IllnessDraft>(k: K, v: IllnessDraft[K]) => onChange({ ...value, [k]: v })
  const validEnd = !value.endDate || value.endDate >= value.startDate
  // prima gli episodi ancora aperti, poi i più recenti
  const plain = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const choices = [...episodes]
    .sort((a, b) => Number(!b.endDate) - Number(!a.endDate) || b.startDate.localeCompare(a.startDate))
    .filter((e) => !filter.trim() || plain(`${e.category} ${e.description ?? ''}`).includes(plain(filter.trim())))
  const selected = episodes.find((e) => e.id === value.id)
  const pick = (e: Illness) => {
    onChange(illnessToDraft(e))
    setOpen(false)
    setFilter('')
  }
  // in "Già registrato" i campi compaiono solo dopo aver scelto l'episodio
  const showFields = !linkOnly && (mode === 'new' || !!selected)

  if (linkOnly && episodes.length === 0) return <p className="text-sm text-muted">Non ci sono ancora episodi di malattia registrati.</p>

  return (
    <Card className={linkOnly ? 'space-y-3 bg-transparent p-0' : 'space-y-4 border border-ev-illness/40 bg-transparent'}>
      {!linkOnly && (
        <div>
          <span className="block font-medium">🤒 Malattia</span>
          <span className="block text-xs text-muted">L’episodio comparirà anche nella sezione Malattie, collegato a questa visita.</span>
        </div>
      )}
      {!linkOnly && episodes.length > 0 && (
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m)
            setOpen(m === 'existing')
            // cambiando modalità si riparte da zero: in "Già registrato" si salva solo dopo aver scelto
            onChange(emptyIllness(visitDate))
          }}
          options={[
            { value: 'new', label: 'Nuovo episodio' },
            { value: 'existing', label: 'Già registrato' },
          ]}
        />
      )}
      {mode === 'existing' && (
        <div>
          {/* episodio scelto (menù chiuso) */}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
              selected ? 'border-shiba bg-shiba-soft' : 'border-line'
            }`}
          >
            <span className="min-w-0 flex-1">
              {selected ? (
                <>
                  <span className="block truncate font-medium">{selected.category}</span>
                  <span className="block truncate text-xs text-muted">{periodLabel(selected.startDate, selected.endDate)}</span>
                </>
              ) : (
                <span className="text-muted">Scegli l’episodio…</span>
              )}
            </span>
            <span className="shrink-0 text-sm text-shiba">{open ? 'Chiudi ▴' : selected ? 'Cambia ▾' : '▾'}</span>
          </button>
          {/* menù a discesa con filtro ed elenco scorrevole */}
          {open && (
            <div className="mt-1.5 rounded-xl border border-line bg-card-2 p-2">
              {episodes.length > 5 && (
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="🔍 Filtra (es. otite)" className="mb-2 py-2" />
              )}
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {choices.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => pick(e)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left active:bg-line ${
                      value.id === e.id ? 'bg-shiba-soft' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.category}</span>
                      <span className="block truncate text-xs text-muted">{periodLabel(e.startDate, e.endDate)}</span>
                    </span>
                    {!e.endDate && <span className="shrink-0 text-xs text-red-400">in corso</span>}
                  </button>
                ))}
                {choices.length === 0 && <p className="px-2.5 py-2 text-sm text-muted">Nessun episodio trovato</p>}
              </div>
            </div>
          )}
          {selected && !open && (
            <p className="pt-2 text-xs text-muted">
              {linkOnly
                ? 'La visita comparirà tra le visite di questo episodio.'
                : 'Puoi aggiornare qui sotto i dati dell’episodio scelto (ad esempio la data di guarigione).'}
            </p>
          )}
        </div>
      )}
      {showFields && (
        <>
      <Field label="Disturbo">
        <ComboInput value={value.category} onChange={(v) => set('category', v)} options={suggestions} placeholder="es. Otite" />
      </Field>
      <Field label="Descrizione">
        <Input value={value.description} onChange={(e) => set('description', e.target.value)} placeholder="es. orecchio destro arrossato" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inizio">
          <Input type="date" value={value.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Fine">
          <Input type="date" value={value.endDate} min={value.startDate} onChange={(e) => set('endDate', e.target.value)} />
        </Field>
      </div>
      <div className="-mt-2 flex items-center justify-between text-xs text-muted">
        <span>{value.endDate ? (validEnd ? '' : '⚠️ La fine è precedente all’inizio') : 'Senza data di fine è in corso'}</span>
        {value.endDate ? (
          <button type="button" className="text-shiba" onClick={() => set('endDate', '')}>
            Rimuovi fine
          </button>
        ) : (
          <button type="button" className="text-shiba" onClick={() => set('endDate', todayISO())}>
            Guarito oggi
          </button>
        )}
      </div>
      <Field label="Gravità">
        <Segmented
          value={value.severity}
          onChange={(v) => set('severity', v === value.severity ? '' : v)}
          options={[
            { value: 'lieve', label: 'Lieve' },
            { value: 'media', label: 'Media' },
            { value: 'forte', label: 'Forte' },
          ]}
        />
      </Field>
        </>
      )}
    </Card>
  )
}
