import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteWithAttachments, getProfile, newId, type IntervalUnit, type Visit } from '../db'
import { addInterval, formatDate, todayISO } from '../lib/dates'
import { allReminders, visitReminderDate } from '../lib/reminders'
import { ReminderCard } from '../components/ReminderCard'
import { goBack, navigate, presetDate } from '../lib/router'
import { useRecord } from '../lib/useRecord'
import { AttachmentsField, useAttachments } from '../components/Attachments'
import { Card, Empty, Fab, Field, FormActions, Input, Loading, Page, Pill, SectionTitle, Select, TextArea } from '../components/ui'
import { ComboInput } from '../components/ComboInput'

export function VisitsPage({ parts }: { parts: string[] }) {
  // /visite · /visite/nuovo · /visite/nuovo/da/<id> (richiamo) · /visite/<id>
  const [id, , fromId] = parts
  return id ? <VisitForm id={id} fromId={fromId} /> : <VisitList />
}

function VisitList() {
  const visits = useLiveQuery(() => db.visits.orderBy('date').reverse().toArray())
  if (!visits) return <Loading />
  const today = todayISO()
  const upcoming = visits.filter((v) => v.date > today).reverse()
  const past = visits.filter((v) => v.date <= today)
  const reminders = allReminders([], visits)
  return (
    <Page title="Visite mediche" back="/">
      {!visits.length && <Empty>Nessuna visita registrata.<br />Tocca + per aggiungerne una.</Empty>}
      {reminders.length > 0 && (
        <>
          <SectionTitle>Prossimi richiami</SectionTitle>
          <div className="space-y-2">
            {reminders.map((r) => (
              <ReminderCard key={r.key} r={r} />
            ))}
          </div>
        </>
      )}
      {upcoming.length > 0 && <SectionTitle>In programma</SectionTitle>}
      <div className="space-y-2">{upcoming.map((v) => <VisitRow key={v.id} v={v} upcoming />)}</div>
      {past.length > 0 && upcoming.length > 0 && <SectionTitle>Passate</SectionTitle>}
      <div className="space-y-2">{past.map((v) => <VisitRow key={v.id} v={v} />)}</div>
      <Fab to="/visite/nuovo" />
    </Page>
  )
}

function VisitRow({ v, upcoming }: { v: Visit; upcoming?: boolean }) {
  return (
    <Card onClick={() => navigate(`/visite/${v.id}`)}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-10 w-1 shrink-0 rounded-full bg-ev-visit" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{v.type}</span>
            {upcoming && <Pill color="#3b82f6">in programma</Pill>}
          </div>
          <div className="text-sm text-muted">
            {formatDate(v.date)}
            {v.time ? ` · ore ${v.time}` : ''}
            {v.vet ? ` · ${v.vet}` : ''}
            {v.attachmentIds.length ? ` · 📎 ${v.attachmentIds.length}` : ''}
          </div>
          {v.notes && <p className="mt-1 line-clamp-2 text-sm text-[#c9c9d1]">{v.notes}</p>}
          {visitReminderDate(v) && (
            <div className="mt-1 text-xs text-shiba">💉 richiamo il {formatDate(visitReminderDate(v))}</div>
          )}
        </div>
      </div>
    </Card>
  )
}

function VisitForm({ id, fromId }: { id: string; fromId?: string }) {
  const rec = useRecord(db.visits, id)
  const template = useRecord(db.visits, fromId)
  const profile = useLiveQuery(getProfile)
  if (rec === undefined || template === undefined || !profile) return <Loading />
  return <VisitFormInner rec={rec} template={template} types={profile.visitTypes} />
}

function VisitFormInner({ rec, template, types }: { rec: Visit | null; template: Visit | null; types: string[] }) {
  const src = rec ?? template
  // registrando il richiamo, la data proposta è quella prevista dal promemoria
  const templateDue = template?.reminder ? addInterval(template.date, template.reminder.amount, template.reminder.unit) : undefined
  const [date, setDate] = useState(rec?.date ?? templateDue ?? presetDate(todayISO()))
  const [time, setTime] = useState(rec?.time ?? '')
  const [type, setType] = useState(src?.type ?? '')
  const [vet, setVet] = useState(src?.vet ?? '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const [remOn, setRemOn] = useState(!!src?.reminder)
  const [remAmount, setRemAmount] = useState(String(src?.reminder?.amount ?? 1))
  const [remUnit, setRemUnit] = useState<IntervalUnit>(src?.reminder?.unit ?? 'anni')
  const amount = Math.max(1, parseInt(remAmount) || 0)
  const att = useAttachments(rec?.attachmentIds ?? [])

  const save = async () => {
    const attachmentIds = await att.commit()
    await db.visits.put({
      id: rec?.id ?? newId(),
      createdAt: rec?.createdAt ?? Date.now(),
      date,
      time: time || undefined,
      type: type.trim(),
      vet: vet.trim() || undefined,
      notes: notes.trim() || undefined,
      // se cambia l'intervallo l'avviso torna attivo
      reminder: remOn
        ? { amount, unit: remUnit, done: rec?.reminder?.amount === amount && rec.reminder.unit === remUnit ? rec.reminder.done : undefined }
        : undefined,
      attachmentIds,
    })
    // registrata la nuova visita, il promemoria della precedente è completato
    if (template?.reminder) await db.visits.update(template.id, { reminder: { ...template.reminder, done: true } })
    goBack('/visite')
  }

  return (
    <Page title={rec ? 'Modifica visita' : template ? 'Richiamo' : 'Nuova visita'} back="/visite">
      <div className="space-y-4">
        <Field label="Tipo di visita">
          <ComboInput value={type} onChange={setType} options={types} placeholder="es. Controllo" />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Data">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Ora">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">
          Puoi inserire anche una visita futura: comparirà nel calendario Google “Tokyo”. L’ora è facoltativa.
        </p>
        <Field label="Veterinario / clinica">
          <Input value={vet} onChange={(e) => setVet(e.target.value)} placeholder="facoltativo" />
        </Field>
        <Field label="Note">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Esito, indicazioni del veterinario…" />
        </Field>
        <Card className="space-y-3 border border-line bg-transparent">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-medium">💉 Promemoria richiamo</span>
              <span className="block text-xs text-muted">Per vaccini e controlli periodici: ti ricordo quando ripeterli</span>
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
                  <option value="settimane">settimane</option>
                  <option value="mesi">mesi</option>
                  <option value="anni">anni</option>
                </Select>
                <span className="text-sm text-muted">dopo</span>
              </div>
              <p className="text-xs text-muted">
                Richiamo il {formatDate(addInterval(date, amount, remUnit))}: comparirà nel calendario “Tokyo” con un avviso una settimana prima.
              </p>
            </>
          )}
        </Card>
        <AttachmentsField state={att} />
      </div>
      <FormActions
        onSave={save}
        canSave={!!type.trim() && !!date}
        onDelete={rec ? async () => (await deleteWithAttachments('visits', rec.id), goBack('/visite')) : undefined}
      />
    </Page>
  )
}
