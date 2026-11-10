import type { Illness, Severity } from '../db'
import { formatDate, periodLabel, todayISO } from '../lib/dates'
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
}: {
  value: IllnessDraft
  onChange: (d: IllnessDraft) => void
  episodes: Illness[]
  suggestions: string[]
  visitDate: string
}) {
  const mode: 'new' | 'existing' = value.id ? 'existing' : 'new'
  const set = <K extends keyof IllnessDraft>(k: K, v: IllnessDraft[K]) => onChange({ ...value, [k]: v })
  const validEnd = !value.endDate || value.endDate >= value.startDate
  // prima gli episodi ancora aperti, poi i più recenti
  const choices = [...episodes]
    .sort((a, b) => Number(!b.endDate) - Number(!a.endDate) || b.startDate.localeCompare(a.startDate))
    .slice(0, 8)

  return (
    <Card className="space-y-4 border border-ev-illness/40 bg-transparent">
      <div>
        <span className="block font-medium">🤒 Malattia</span>
        <span className="block text-xs text-muted">L’episodio comparirà anche nella sezione Malattie, collegato a questa visita.</span>
      </div>
      {episodes.length > 0 && (
        <Segmented
          value={mode}
          onChange={(m) => onChange(m === 'new' ? emptyIllness(visitDate) : illnessToDraft(choices[0]))}
          options={[
            { value: 'new', label: 'Nuovo episodio' },
            { value: 'existing', label: 'Già registrato' },
          ]}
        />
      )}
      {mode === 'existing' && (
        <div className="space-y-1.5">
          {choices.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onChange(illnessToDraft(e))}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                value.id === e.id ? 'border-shiba bg-shiba-soft' : 'border-line'
              }`}
            >
              <span className={`size-4 shrink-0 rounded-full border-2 ${value.id === e.id ? 'border-shiba bg-shiba' : 'border-muted'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.category}</span>
                <span className="block truncate text-xs text-muted">{periodLabel(e.startDate, e.endDate)}</span>
              </span>
            </button>
          ))}
          <p className="pt-1 text-xs text-muted">Puoi aggiornare qui sotto i dati dell’episodio scelto (ad esempio la data di guarigione).</p>
        </div>
      )}
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
      {mode === 'existing' && value.id && (
        <p className="text-xs text-muted">Episodio iniziato il {formatDate(value.startDate)}.</p>
      )}
    </Card>
  )
}
