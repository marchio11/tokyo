import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteWithAttachments, newId, type IntervalUnit, type Medication, type MedKind } from '../db'
import { addDays, addInterval, formatDate, periodLabel, todayISO } from '../lib/dates'
import { dueReminders, reminderText } from '../lib/reminders'
import { goBack, navigate } from '../lib/router'
import { useRecord } from '../lib/useRecord'
import { AttachmentsField, useAttachments } from '../components/Attachments'
import { Button, Card, Empty, Fab, Field, FormActions, Input, Loading, Page, Pill, SectionTitle, Segmented, Select, TextArea } from '../components/ui'

export const MED_KINDS: { value: MedKind; label: string; color: string }[] = [
  { value: 'farmaco', label: 'Farmaco', color: '#f97316' },
  { value: 'integratore', label: 'Integratore', color: '#22c55e' },
  { value: 'antiparassitario', label: 'Antiparass.', color: '#14b8a6' },
]
export const medColor = (k: MedKind) => MED_KINDS.find((m) => m.value === k)!.color

export function MedicationsPage({ parts }: { parts: string[] }) {
  // /farmaci · /farmaci/nuovo · /farmaci/nuovo/da/<id> · /farmaci/<id>
  const [id, , fromId] = parts
  return id ? <MedForm id={id} fromId={fromId} /> : <MedList />
}

function MedList() {
  const meds = useLiveQuery(() => db.medications.orderBy('startDate').reverse().toArray())
  if (!meds) return <Loading />
  const today = todayISO()
  const active = meds.filter((m) => m.startDate <= today && (!m.endDate || m.endDate >= today))
  const future = meds.filter((m) => m.startDate > today)
  const ended = meds.filter((m) => m.endDate && m.endDate < today)
  const reminders = dueReminders(meds)

  return (
    <Page title="Farmaci e integratori" back="/">
      {!meds.length && <Empty>Nessun farmaco o integratore registrato.<br />Tocca + per aggiungerne uno.</Empty>}

      {reminders.length > 0 && (
        <>
          <SectionTitle>Prossimi cicli</SectionTitle>
          <div className="space-y-2">
            {reminders.map((r) => (
              <ReminderCard key={r.med.id} med={r.med} dueDate={r.dueDate} daysLeft={r.daysLeft} />
            ))}
          </div>
        </>
      )}
      {active.length > 0 && <SectionTitle>In corso</SectionTitle>}
      <div className="space-y-2">{active.map((m) => <MedRow key={m.id} m={m} />)}</div>
      {future.length > 0 && <SectionTitle>Programmati</SectionTitle>}
      <div className="space-y-2">{future.map((m) => <MedRow key={m.id} m={m} />)}</div>
      {ended.length > 0 && <SectionTitle>Terminati</SectionTitle>}
      <div className="space-y-2 opacity-80">{ended.map((m) => <MedRow key={m.id} m={m} />)}</div>
      <Fab to="/farmaci/nuovo" />
    </Page>
  )
}

export function ReminderCard({ med, dueDate, daysLeft, compact }: { med: Medication; dueDate: string; daysLeft: number; compact?: boolean }) {
  const urgent = daysLeft <= 7
  return (
    <Card className={urgent ? 'ring-1 ring-shiba/60' : ''}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{daysLeft <= 0 ? '⏰' : '🔔'}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">Nuovo ciclo: {med.name}</div>
          <div className={`text-sm ${urgent ? 'text-shiba' : 'text-muted'}`}>
            {reminderText(daysLeft)} · {formatDate(dueDate)}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="ghost" className="py-2 text-sm" onClick={() => db.medications.update(med.id, { reminder: { ...med.reminder!, done: true } })}>
            Archivia avviso
          </Button>
          <Button className="py-2 text-sm" onClick={() => navigate(`/farmaci/nuovo/da/${med.id}`)}>
            Avvia ciclo
          </Button>
        </div>
      )}
    </Card>
  )
}

function MedRow({ m }: { m: Medication }) {
  const color = medColor(m.kind)
  return (
    <Card onClick={() => navigate(`/farmaci/${m.id}`)}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{m.name}</span>
            <Pill color={color}>{m.kind}</Pill>
          </div>
          <div className="text-sm text-muted">{periodLabel(m.startDate, m.endDate)}</div>
          {(m.dosage || m.frequency) && (
            <div className="text-sm text-[#c9c9d1]">{[m.dosage, m.frequency].filter(Boolean).join(' · ')}</div>
          )}
          {m.reminder && !m.reminder.done && (
            <div className="mt-1 text-xs text-shiba">
              🔔 nuovo ciclo {m.reminder.amount} {m.reminder.unit} dopo la fine
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function MedForm({ id, fromId }: { id: string; fromId?: string }) {
  const rec = useRecord(db.medications, id)
  const template = useRecord(db.medications, fromId)
  if (rec === undefined || template === undefined) return <Loading />
  return <MedFormInner rec={rec} template={template} />
}

function MedFormInner({ rec, template }: { rec: Medication | null; template: Medication | null }) {
  const src = rec ?? template
  const [kind, setKind] = useState<MedKind>(src?.kind ?? 'farmaco')
  const [name, setName] = useState(src?.name ?? '')
  const [dosage, setDosage] = useState(src?.dosage ?? '')
  const [frequency, setFrequency] = useState(src?.frequency ?? '')
  const [startDate, setStartDate] = useState(rec?.startDate ?? todayISO())
  const [endDate, setEndDate] = useState(rec?.endDate ?? '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const [remOn, setRemOn] = useState(!!src?.reminder)
  const [remAmount, setRemAmount] = useState(String(src?.reminder?.amount ?? 2))
  const [remUnit, setRemUnit] = useState<IntervalUnit>(src?.reminder?.unit ?? 'mesi')
  const att = useAttachments(rec?.attachmentIds ?? [])

  const validEnd = !endDate || endDate >= startDate
  const amount = Math.max(1, parseInt(remAmount) || 0)

  const save = async () => {
    const attachmentIds = await att.commit()
    await db.medications.put({
      id: rec?.id ?? newId(),
      createdAt: rec?.createdAt ?? Date.now(),
      kind,
      name: name.trim(),
      dosage: dosage.trim() || undefined,
      frequency: frequency.trim() || undefined,
      startDate,
      endDate: endDate || undefined,
      notes: notes.trim() || undefined,
      // se l'utente cambia l'intervallo l'avviso torna attivo
      reminder: remOn
        ? { amount, unit: remUnit, done: rec?.reminder?.amount === amount && rec.reminder.unit === remUnit ? rec.reminder.done : undefined }
        : undefined,
      attachmentIds,
    })
    // avviando un nuovo ciclo, l'avviso del ciclo precedente viene archiviato
    if (template?.reminder) await db.medications.update(template.id, { reminder: { ...template.reminder, done: true } })
    goBack('/farmaci')
  }

  return (
    <Page title={rec ? 'Modifica' : template ? 'Nuovo ciclo' : 'Nuovo farmaco / integratore'} back="/farmaci">
      <div className="space-y-4">
        <Segmented value={kind} onChange={setKind} options={MED_KINDS} />
        <Field label="Nome prodotto">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Omega 3" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dosaggio">
            <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="es. 1 compressa" />
          </Field>
          <Field label="Frequenza">
            <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="es. 2 volte al giorno" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inizio">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Fine">
            <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {endDate ? (
            <>
              {!validEnd && <span>⚠️ La fine è precedente all’inizio</span>}
              <button className="ml-auto text-shiba" onClick={() => setEndDate('')}>
                Rimuovi fine (in corso)
              </button>
            </>
          ) : (
            <>
              <span className="mr-auto">Senza fine = in corso.</span>
              <span>Durata:</span>
              {[7, 10, 14, 30].map((d) => (
                <button key={d} className="rounded-full border border-line px-2 py-0.5 text-shiba" onClick={() => setEndDate(addDays(startDate, d - 1))}>
                  {d}gg
                </button>
              ))}
            </>
          )}
        </div>

        <Card className="space-y-3 border border-line bg-transparent">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-medium">🔔 Avviso nuovo ciclo</span>
              <span className="block text-xs text-muted">Ricordami di ripartire dopo la fine di questo ciclo</span>
            </span>
            <input type="checkbox" checked={remOn} onChange={(e) => setRemOn(e.target.checked)} className="size-6 accent-shiba" />
          </label>
          {remOn && (
            <>
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="numeric" min={1} value={remAmount} onChange={(e) => setRemAmount(e.target.value)} className="w-20 text-center" />
                <Select value={remUnit} onChange={(e) => setRemUnit(e.target.value as IntervalUnit)} className="flex-1">
                  <option value="giorni">giorni</option>
                  <option value="settimane">settimane</option>
                  <option value="mesi">mesi</option>
                </Select>
                <span className="text-sm text-muted">dopo la fine</span>
              </div>
              <p className="text-xs text-muted">
                {endDate
                  ? `Avviso il ${formatDate(addInterval(endDate, amount, remUnit))}`
                  : 'L’avviso partirà quando inserirai la data di fine.'}
              </p>
            </>
          )}
        </Card>

        <Field label="Note">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <AttachmentsField state={att} />
      </div>
      <FormActions
        onSave={save}
        canSave={!!name.trim() && !!startDate && validEnd}
        onDelete={rec ? async () => (await deleteWithAttachments('medications', rec.id), goBack('/farmaci')) : undefined}
      />
    </Page>
  )
}
