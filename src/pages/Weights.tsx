import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Weight } from '../db'
import { addInterval, daysBetween, formatDate, todayISO } from '../lib/dates'
import { goBack, navigate, presetDate } from '../lib/router'
import { useRecord } from '../lib/useRecord'
import { WeightChart } from '../components/WeightChart'
import { Card, Empty, Fab, Field, FormActions, Input, Loading, Page, SectionTitle, Segmented, TextArea } from '../components/ui'

type Range = '3m' | '6m' | '1a' | 'tutto'

export function WeightsPage({ id }: { id?: string }) {
  return id ? <WeightForm id={id} /> : <WeightList />
}

export const fmtKg = (kg: number) => `${kg.toLocaleString('it-IT', { maximumFractionDigits: 2 })} kg`

function WeightList() {
  const list = useLiveQuery(() => db.weights.orderBy('date').reverse().toArray())
  const [range, setRange] = useState<Range>('1a')
  if (!list) return <Loading />
  const today = todayISO()
  const from =
    range === 'tutto' ? '' : addInterval(today, range === '3m' ? -3 : range === '6m' ? -6 : -12, 'mesi')
  const chartData = list.filter((w) => w.date >= from)
  const last = list[0]
  const prev = list[1]
  const delta = last && prev ? last.kg - prev.kg : 0

  return (
    <Page title="Peso" back="/">
      {!list.length ? (
        <Empty>Nessuna pesata registrata.<br />Tocca + per inserire il peso di Tokyo.</Empty>
      ) : (
        <>
          <Card>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs tracking-wider text-muted uppercase">Ultimo peso</div>
                <div className="text-4xl font-semibold">{fmtKg(last.kg)}</div>
                <div className="text-sm text-muted">{formatDate(last.date)} · {daysBetween(last.date, today)} gg fa</div>
              </div>
              {prev && (
                <div className="text-right text-sm">
                  <div className={delta > 0 ? 'text-shiba' : delta < 0 ? 'text-sky-400' : 'text-muted'}>
                    {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {fmtKg(Math.abs(delta))}
                  </div>
                  <div className="text-muted">dalla pesata precedente</div>
                </div>
              )}
            </div>
            {chartData.length > 0 ? (
              <WeightChart data={chartData} />
            ) : (
              <p className="mt-4 text-center text-sm text-muted">Nessuna pesata in questo periodo</p>
            )}
            <div className="mt-3">
              <Segmented
                value={range}
                onChange={setRange}
                options={[
                  { value: '3m', label: '3 mesi' },
                  { value: '6m', label: '6 mesi' },
                  { value: '1a', label: '1 anno' },
                  { value: 'tutto', label: 'Tutto' },
                ]}
              />
            </div>
          </Card>
          <SectionTitle>Storico</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {list.map((w, i) => {
              const d = list[i + 1] ? w.kg - list[i + 1].kg : null
              return (
                <button key={w.id} onClick={() => navigate(`/peso/${w.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-card-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{fmtKg(w.kg)}</div>
                    <div className="truncate text-sm text-muted">
                      {formatDate(w.date)}
                      {w.notes ? ` · ${w.notes}` : ''}
                    </div>
                  </div>
                  {d !== null && d !== 0 && (
                    <span className={`text-sm ${d > 0 ? 'text-shiba' : 'text-sky-400'}`}>
                      {d > 0 ? '+' : '−'}
                      {Math.abs(d).toLocaleString('it-IT', { maximumFractionDigits: 2 })}
                    </span>
                  )}
                </button>
              )
            })}
          </Card>
        </>
      )}
      <Fab to="/peso/nuovo" />
    </Page>
  )
}

function WeightForm({ id }: { id: string }) {
  const rec = useRecord(db.weights, id)
  if (rec === undefined) return <Loading />
  return <WeightFormInner rec={rec} />
}

function WeightFormInner({ rec }: { rec: Weight | null }) {
  const [date, setDate] = useState(rec?.date ?? presetDate(todayISO()))
  const [kg, setKg] = useState(rec ? String(rec.kg).replace('.', ',') : '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const value = parseFloat(kg.replace(',', '.'))
  const valid = !isNaN(value) && value > 0 && value < 100

  const save = async () => {
    await db.weights.put({
      id: rec?.id ?? newId(),
      createdAt: rec?.createdAt ?? Date.now(),
      date,
      kg: Math.round(value * 100) / 100,
      notes: notes.trim() || undefined,
    })
    goBack('/peso')
  }

  return (
    <Page title={rec ? 'Modifica pesata' : 'Nuova pesata'} back="/peso">
      <div className="space-y-4">
        <Field label="Peso (kg)">
          <Input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="es. 9,8" autoFocus={!rec} className="text-2xl" />
        </Field>
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="es. pesato dal veterinario" />
        </Field>
      </div>
      <FormActions
        onSave={save}
        canSave={valid && !!date}
        onDelete={rec ? async () => (await db.weights.delete(rec.id), goBack('/peso')) : undefined}
      />
    </Page>
  )
}
