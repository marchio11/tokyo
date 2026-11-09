import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteWithAttachments, getProfile, newId, type Visit } from '../db'
import { formatDate, todayISO } from '../lib/dates'
import { goBack, navigate } from '../lib/router'
import { useRecord } from '../lib/useRecord'
import { AttachmentsField, useAttachments } from '../components/Attachments'
import { Card, Empty, Fab, Field, FormActions, Input, Loading, Page, Pill, SectionTitle, TextArea } from '../components/ui'
import { ComboInput } from '../components/ComboInput'

export function VisitsPage({ id }: { id?: string }) {
  return id ? <VisitForm id={id} /> : <VisitList />
}

function VisitList() {
  const visits = useLiveQuery(() => db.visits.orderBy('date').reverse().toArray())
  if (!visits) return <Loading />
  const today = todayISO()
  const upcoming = visits.filter((v) => v.date > today).reverse()
  const past = visits.filter((v) => v.date <= today)
  return (
    <Page title="Visite mediche" back="/">
      {!visits.length && <Empty>Nessuna visita registrata.<br />Tocca + per aggiungerne una.</Empty>}
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
        </div>
      </div>
    </Card>
  )
}

function VisitForm({ id }: { id: string }) {
  const rec = useRecord(db.visits, id)
  const profile = useLiveQuery(getProfile)
  if (rec === undefined || !profile) return <Loading />
  return <VisitFormInner rec={rec} types={profile.visitTypes} />
}

function VisitFormInner({ rec, types }: { rec: Visit | null; types: string[] }) {
  const [date, setDate] = useState(rec?.date ?? todayISO())
  const [time, setTime] = useState(rec?.time ?? '')
  const [type, setType] = useState(rec?.type ?? '')
  const [vet, setVet] = useState(rec?.vet ?? '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
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
      attachmentIds,
    })
    goBack('/visite')
  }

  return (
    <Page title={rec ? 'Modifica visita' : 'Nuova visita'} back="/visite">
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
