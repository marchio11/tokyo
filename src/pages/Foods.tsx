import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type Food, type FoodKind } from '../db'
import { periodLabel, todayISO } from '../lib/dates'
import { goBack, navigate, presetDate } from '../lib/router'
import { useRecord } from '../lib/useRecord'
import { Card, Empty, Fab, Field, FormActions, Input, Loading, Page, Pill, SectionTitle, Segmented, TextArea } from '../components/ui'

const KINDS: { value: FoodKind; label: string }[] = [
  { value: 'crocchette', label: 'Crocchette' },
  { value: 'umido', label: 'Umido' },
  { value: 'snack', label: 'Snack' },
  { value: 'altro', label: 'Altro' },
]

export function FoodsPage({ id }: { id?: string }) {
  return id ? <FoodForm id={id} /> : <FoodList />
}

function FoodList() {
  const foods = useLiveQuery(() => db.foods.orderBy('startDate').reverse().toArray())
  if (!foods) return <Loading />
  const today = todayISO()
  const current = foods.filter((f) => f.startDate <= today && (!f.endDate || f.endDate >= today))
  const other = foods.filter((f) => !current.includes(f))
  return (
    <Page title="Alimentazione" back="/">
      {!foods.length && <Empty>Nessun alimento registrato.<br />Tocca + per aggiungere le crocchette attuali.</Empty>}
      {current.length > 0 && <SectionTitle>Attuale</SectionTitle>}
      <div className="space-y-2">{current.map((f) => <FoodRow key={f.id} f={f} />)}</div>
      {other.length > 0 && <SectionTitle>Storico</SectionTitle>}
      <div className="space-y-2 opacity-80">{other.map((f) => <FoodRow key={f.id} f={f} />)}</div>
      <Fab to="/cibo/nuovo" />
    </Page>
  )
}

function FoodRow({ f }: { f: Food }) {
  return (
    <Card onClick={() => navigate(`/cibo/${f.id}`)}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-10 w-1 shrink-0 rounded-full bg-ev-food" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{f.name}</span>
            <Pill color="#a855f7">{f.kind}</Pill>
          </div>
          <div className="text-sm text-muted">{periodLabel(f.startDate, f.endDate)}</div>
          {f.notes && <p className="mt-1 line-clamp-2 text-sm text-[#c9c9d1]">{f.notes}</p>}
        </div>
      </div>
    </Card>
  )
}

function FoodForm({ id }: { id: string }) {
  const rec = useRecord(db.foods, id)
  if (rec === undefined) return <Loading />
  return <FoodFormInner rec={rec} />
}

function FoodFormInner({ rec }: { rec: Food | null }) {
  const [kind, setKind] = useState<FoodKind>(rec?.kind ?? 'crocchette')
  const [name, setName] = useState(rec?.name ?? '')
  const [startDate, setStartDate] = useState(rec?.startDate ?? presetDate(todayISO()))
  const [endDate, setEndDate] = useState(rec?.endDate ?? '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const validEnd = !endDate || endDate >= startDate

  const save = async () => {
    await db.foods.put({
      id: rec?.id ?? newId(),
      createdAt: rec?.createdAt ?? Date.now(),
      kind,
      name: name.trim(),
      startDate,
      endDate: endDate || undefined,
      notes: notes.trim() || undefined,
    })
    goBack('/cibo')
  }

  return (
    <Page title={rec ? 'Modifica alimento' : 'Nuovo alimento'} back="/cibo">
      <div className="space-y-4">
        <Segmented value={kind} onChange={setKind} options={KINDS} />
        <Field label="Prodotto">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Marca – Salmone e patate" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dal">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Al">
            <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="-mt-2 flex justify-between text-xs text-muted">
          <span>{!validEnd ? '⚠️ La fine è precedente all’inizio' : endDate ? '' : 'Senza data di fine = ancora in uso'}</span>
          {endDate && (
            <button className="text-shiba" onClick={() => setEndDate('')}>
              Rimuovi fine
            </button>
          )}
        </div>
        <Field label="Note">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Quantità giornaliera, reazioni, gradimento…" />
        </Field>
      </div>
      <FormActions
        onSave={save}
        canSave={!!name.trim() && !!startDate && validEnd}
        onDelete={rec ? async () => (await db.foods.delete(rec.id), goBack('/cibo')) : undefined}
      />
    </Page>
  )
}
