import { DetailCard, DetailPage, DetailRow, DetailSection } from '../components/Detail'
import { SavedAttachments } from '../components/Attachments'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteWithAttachments, newId, type IntervalUnit, type Medication, type MedKind } from '../db'
import { addDays, addInterval, formatDate, periodLabel, todayISO } from '../lib/dates'
import { allReminders, closePreviousCycles } from '../lib/reminders'
import { Highlights } from '../components/Highlights'
import { ForIllness, FromVisit } from '../components/Links'
import { ComboInput } from '../components/ComboInput'
import { goBack, navigate, presetDate } from '../lib/router'
import { useRecord } from '../lib/useRecord'
import { AttachmentsField, useAttachments } from '../components/Attachments'
import { Card, Empty, Fab, Field, FormActions, Input, Loading, Page, Pill, SectionTitle, Segmented, Select, TextArea } from '../components/ui'

export const MED_KINDS: { value: MedKind; label: string; color: string }[] = [
  { value: 'farmaco', label: 'Farmaco', color: '#f97316' },
  { value: 'integratore', label: 'Integratore', color: '#22c55e' },
  { value: 'antiparassitario', label: 'Antiparass.', color: '#14b8a6' },
]
export const medColor = (k: MedKind) => MED_KINDS.find((m) => m.value === k)!.color

export function MedicationsPage({ parts }: { parts: string[] }) {
  // /farmaci · /farmaci/nuovo · /farmaci/<id> (scheda) · /farmaci/<id>/modifica
  const [id, sub] = parts
  if (!id) return <MedList />
  return id === 'nuovo' || sub === 'modifica' ? <MedForm id={id} /> : <MedDetail id={id} />
}

function MedList() {
  const meds = useLiveQuery(() => db.medications.orderBy('startDate').reverse().toArray())
  if (!meds) return <Loading />
  const today = todayISO()
  const active = meds.filter((m) => m.startDate <= today && (!m.endDate || m.endDate >= today))
  const future = meds.filter((m) => m.startDate > today)
  const ended = meds.filter((m) => m.endDate && m.endDate < today)
  const reminders = allReminders(meds)

  return (
    <Page title="Farmaci e integratori" back="/">
      {!meds.length && <Empty>Nessun farmaco o integratore registrato.<br />Tocca + per aggiungerne uno.</Empty>}

      <Highlights
        items={reminders.map((r) => ({
          key: r.key,
          date: r.dueDate,
          icon: '🔔',
          title: r.title.replace(/^Nuovo ciclo: /, ''),
          sub: 'inizio nuovo ciclo',
          href: `/farmaci/${r.id}`,
        }))}
      />
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
          {m.visitId ? <FromVisit visitId={m.visitId} /> : m.illnessId && <ForIllness illnessId={m.illnessId} />}
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

function MedForm({ id }: { id: string }) {
  const rec = useRecord(db.medications, id)
  const all = useLiveQuery(() => db.medications.toArray())
  if (rec === undefined || !all) return <Loading />
  return <MedFormInner rec={rec} all={all} />
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function MedFormInner({ rec, all }: { rec: Medication | null; all: Medication[] }) {
  const [kind, setKind] = useState<MedKind>(rec?.kind ?? 'farmaco')
  const [name, setName] = useState(rec?.name ?? '')
  const [dosage, setDosage] = useState(rec?.dosage ?? '')
  const [frequency, setFrequency] = useState(rec?.frequency ?? '')
  const [startDate, setStartDate] = useState(rec?.startDate ?? presetDate(todayISO()))
  const [endDate, setEndDate] = useState(rec?.endDate ?? '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const [remOn, setRemOn] = useState(!!rec?.reminder)
  const [remAmount, setRemAmount] = useState(String(rec?.reminder?.amount ?? 2))
  const [remUnit, setRemUnit] = useState<IntervalUnit>(rec?.reminder?.unit ?? 'mesi')
  const att = useAttachments(rec?.attachmentIds ?? [])

  // prodotti già usati, dal più recente: toccandone uno si ricompilano tipo, dosaggio e avviso
  const previous = [...all].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const names = [...new Set(previous.map((m) => m.name))].slice(0, 8)
  const changeName = (n: string) => {
    setName(n)
    if (rec) return
    const prev = previous.find((m) => sameName(m.name, n))
    if (!prev) return
    setKind(prev.kind)
    if (!dosage) setDosage(prev.dosage ?? '')
    if (!frequency) setFrequency(prev.frequency ?? '')
    if (prev.reminder && !remOn) {
      setRemOn(true)
      setRemAmount(String(prev.reminder.amount))
      setRemUnit(prev.reminder.unit)
    }
  }

  const validEnd = !endDate || endDate >= startDate
  const amount = Math.max(1, parseInt(remAmount) || 0)

  const save = async () => {
    const attachmentIds = await att.commit()
    const id = rec?.id ?? newId()
    await db.medications.put({
      id,
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
    await closePreviousCycles({ id, name, startDate })
    goBack('/farmaci')
  }

  return (
    <Page title={rec ? 'Modifica' : 'Nuovo farmaco / integratore'} back="/farmaci">
      <div className="space-y-4">
        {(rec?.visitId || rec?.illnessId) && (
          <div className="flex flex-col gap-1">
            {rec.visitId && <FromVisit visitId={rec.visitId} />}
            {rec.illnessId && <ForIllness illnessId={rec.illnessId} />}
          </div>
        )}
        <Segmented value={kind} onChange={setKind} options={MED_KINDS} />
        <Field label="Nome prodotto">
          <ComboInput value={name} onChange={changeName} options={names} placeholder="es. Omega 3" />
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
              <span className="w-full">Senza fine = in corso. Durata rapida:</span>
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
                <div className="w-20 shrink-0">
                  <Input type="number" inputMode="numeric" min={1} value={remAmount} onChange={(e) => setRemAmount(e.target.value)} className="text-center" />
                </div>
                <Select value={remUnit} onChange={(e) => setRemUnit(e.target.value as IntervalUnit)} className="flex-1">
                  <option value="giorni">giorni</option>
                  <option value="settimane">settimane</option>
                  <option value="mesi">mesi</option>
                  <option value="anni">anni</option>
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

/** Scheda di sola lettura del farmaco / integratore */
function MedDetail({ id }: { id: string }) {
  const m = useLiveQuery(async () => (await db.medications.get(id)) ?? null, [id])
  return (
    <DetailPage title={m?.name ?? 'Farmaco'} back="/farmaci" editHref={`/farmaci/${id}/modifica`} record={m}>
      {(m) => (
        <>
          <DetailCard accent={medColor(m.kind)}>
            <DetailRow label="Tipo">{MED_KINDS.find((k) => k.value === m.kind)?.label.replace('Antiparass.', 'Antiparassitario')}</DetailRow>
            <DetailRow label="Periodo">{periodLabel(m.startDate, m.endDate)}</DetailRow>
            <DetailRow label="Dosaggio">{m.dosage}</DetailRow>
            <DetailRow label="Frequenza">{m.frequency}</DetailRow>
            <DetailRow label="Nuovo ciclo">
              {m.reminder &&
                (m.reminder.done
                  ? 'già avviato'
                  : m.endDate
                    ? `${formatDate(addInterval(m.endDate, m.reminder.amount, m.reminder.unit))} (${m.reminder.amount} ${m.reminder.unit} dopo la fine)`
                    : `${m.reminder.amount} ${m.reminder.unit} dopo la fine`)}
            </DetailRow>
            <DetailRow label="Note">{m.notes}</DetailRow>
          </DetailCard>
          {(m.visitId || m.illnessId) && (
            <div className="flex flex-col gap-1.5 px-1">
              {m.visitId && <FromVisit visitId={m.visitId} />}
              {m.illnessId && <ForIllness illnessId={m.illnessId} />}
            </div>
          )}
          {m.attachmentIds.length > 0 && (
            <DetailSection title="Allegati">
              <SavedAttachments ids={m.attachmentIds} />
            </DetailSection>
          )}
        </>
      )}
    </DetailPage>
  )
}
