import { useState } from 'react'
import { newId, type IntervalUnit, type Medication, type MedKind } from '../db'
import { addDays, addInterval, formatDate } from '../lib/dates'
import { ComboInput } from './ComboInput'
import { Card, Field, Input, Segmented, Select } from './ui'

const KINDS: { value: MedKind; label: string }[] = [
  { value: 'farmaco', label: 'Farmaco' },
  { value: 'integratore', label: 'Integratore' },
  { value: 'antiparassitario', label: 'Antiparass.' },
]

/** Farmaco prescritto in una visita, in fase di modifica */
export interface MedDraft {
  key: string
  /** presente se il farmaco esiste già nella sezione Farmaci */
  existing?: Medication
  kind: MedKind
  name: string
  dosage: string
  frequency: string
  startDate: string
  endDate: string
  remOn: boolean
  remAmount: string
  remUnit: IntervalUnit
}

export const newMedDraft = (date: string): MedDraft => ({
  key: newId(),
  kind: 'farmaco',
  name: '',
  dosage: '',
  frequency: '',
  startDate: date,
  endDate: '',
  remOn: false,
  remAmount: '2',
  remUnit: 'mesi',
})

export const medToDraft = (m: Medication): MedDraft => ({
  key: m.id,
  existing: m,
  kind: m.kind,
  name: m.name,
  dosage: m.dosage ?? '',
  frequency: m.frequency ?? '',
  startDate: m.startDate,
  endDate: m.endDate ?? '',
  remOn: !!m.reminder,
  remAmount: String(m.reminder?.amount ?? 2),
  remUnit: m.reminder?.unit ?? 'mesi',
})

export const medDraftValid = (d: MedDraft) => !!d.name.trim() && !!d.startDate && (!d.endDate || d.endDate >= d.startDate)

/** Converte la bozza nel record da salvare nella sezione Farmaci */
export function draftToMed(d: MedDraft, link: { visitId?: string; illnessId?: string }): Medication {
  const amount = Math.max(1, parseInt(d.remAmount) || 0)
  const prev = d.existing?.reminder
  return {
    id: d.existing?.id ?? d.key,
    createdAt: d.existing?.createdAt ?? Date.now(),
    kind: d.kind,
    name: d.name.trim(),
    dosage: d.dosage.trim() || undefined,
    frequency: d.frequency.trim() || undefined,
    startDate: d.startDate,
    endDate: d.endDate || undefined,
    notes: d.existing?.notes,
    reminder: d.remOn ? { amount, unit: d.remUnit, done: prev?.amount === amount && prev.unit === d.remUnit ? prev.done : undefined } : undefined,
    visitId: link.visitId ?? d.existing?.visitId,
    illnessId: link.illnessId ?? d.existing?.illnessId,
    attachmentIds: d.existing?.attachmentIds ?? [],
  }
}

/** Sezione richiudibile "Farmaci prescritti" del modulo visita */
export function Prescriptions({
  drafts,
  onChange,
  visitDate,
  known,
  title = 'Farmaci prescritti',
  hint = 'Compariranno anche nella sezione Farmaci, collegati a questa visita.',
}: {
  drafts: MedDraft[]
  onChange: (d: MedDraft[]) => void
  /** data proposta come inizio dei nuovi farmaci */
  visitDate: string
  title?: string
  hint?: string
  /** prodotti già usati (dal più recente), per ricompilare i campi con un tocco */
  known: Medication[]
}) {
  const [open, setOpen] = useState(drafts.length > 0)
  const update = (key: string, patch: Partial<MedDraft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  const remove = (d: MedDraft) => {
    if (d.existing && !confirm(`Eliminare “${d.name}” anche dalla sezione Farmaci?`)) return
    onChange(drafts.filter((x) => x.key !== d.key))
  }
  const names = [...new Set(known.map((m) => m.name))].slice(0, 8)

  return (
    <Card className="border border-ev-drug/40 bg-transparent p-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span>
          <span className="block font-medium">
            💊 {title}
            {drafts.length ? ` (${drafts.length})` : ''}
          </span>
          <span className="block text-xs text-muted">{hint}</span>
        </span>
        <span className={`text-xl text-muted transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3">
          {drafts.map((d, i) => {
            const validEnd = !d.endDate || d.endDate >= d.startDate
            const amount = Math.max(1, parseInt(d.remAmount) || 0)
            const pickName = (n: string) => {
              const prev = known.find((m) => m.name.trim().toLowerCase() === n.trim().toLowerCase())
              update(
                d.key,
                prev && !d.existing
                  ? {
                      name: n,
                      kind: prev.kind,
                      dosage: d.dosage || prev.dosage || '',
                      frequency: d.frequency || prev.frequency || '',
                      ...(prev.reminder && !d.remOn ? { remOn: true, remAmount: String(prev.reminder.amount), remUnit: prev.reminder.unit } : {}),
                    }
                  : { name: n },
              )
            }
            return (
              <div key={d.key} className="space-y-3 rounded-xl bg-card-2 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted">Farmaco {i + 1}</span>
                  <button type="button" onClick={() => remove(d)} className="text-sm text-red-400">
                    Rimuovi
                  </button>
                </div>
                <Segmented value={d.kind} onChange={(k) => update(d.key, { kind: k })} options={KINDS} />
                <Field label="Nome prodotto">
                  <ComboInput value={d.name} onChange={pickName} options={names} placeholder="es. Antibiotico" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Dosaggio">
                    <Input value={d.dosage} onChange={(e) => update(d.key, { dosage: e.target.value })} placeholder="es. 1 compressa" />
                  </Field>
                  <Field label="Frequenza">
                    <Input value={d.frequency} onChange={(e) => update(d.key, { frequency: e.target.value })} placeholder="es. 2 volte al giorno" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Inizio">
                    <Input type="date" value={d.startDate} onChange={(e) => update(d.key, { startDate: e.target.value })} className="px-2 text-[16px]" />
                  </Field>
                  <Field label="Fine">
                    <Input type="date" value={d.endDate} min={d.startDate} onChange={(e) => update(d.key, { endDate: e.target.value })} className="px-2 text-[16px]" />
                  </Field>
                </div>
                <div className="-mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {d.endDate ? (
                    <>
                      {!validEnd && <span>⚠️ La fine è precedente all’inizio</span>}
                      <button type="button" className="ml-auto text-shiba" onClick={() => update(d.key, { endDate: '' })}>
                        Rimuovi fine (in corso)
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="w-full">Senza fine = in corso. Durata rapida:</span>
                      {[5, 7, 10, 14, 30].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className="rounded-full border border-line px-2 py-0.5 text-shiba"
                          onClick={() => update(d.key, { endDate: addDays(d.startDate, n - 1) })}
                        >
                          {n}gg
                        </button>
                      ))}
                    </>
                  )}
                </div>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm">🔔 Avviso nuovo ciclo</span>
                  <input type="checkbox" checked={d.remOn} onChange={(e) => update(d.key, { remOn: e.target.checked })} className="size-6 accent-shiba" />
                </label>
                {d.remOn && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-20 shrink-0">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={d.remAmount}
                          onChange={(e) => update(d.key, { remAmount: e.target.value })}
                          className="text-center"
                        />
                      </div>
                      <Select value={d.remUnit} onChange={(e) => update(d.key, { remUnit: e.target.value as IntervalUnit })} className="flex-1">
                        <option value="giorni">giorni</option>
                        <option value="settimane">settimane</option>
                        <option value="mesi">mesi</option>
                        <option value="anni">anni</option>
                      </Select>
                      <span className="text-sm text-muted">dopo la fine</span>
                    </div>
                    <p className="text-xs text-muted">
                      {d.endDate ? `Nuovo ciclo il ${formatDate(addInterval(d.endDate, amount, d.remUnit))}` : 'L’avviso partirà quando inserirai la data di fine.'}
                    </p>
                  </>
                )}
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => onChange([...drafts, newMedDraft(visitDate)])}
            className="w-full rounded-xl border border-dashed border-line py-3 text-sm text-shiba"
          >
            + Aggiungi farmaco
          </button>
        </div>
      )}
    </Card>
  )
}
