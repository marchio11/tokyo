import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  deleteWithAttachments,
  getProfile,
  illnessSuggestions,
  newId,
  type Illness,
  type IntervalUnit,
  type Medication,
  type Profile,
  type Visit,
} from '../db'
import { addInterval, formatDate, todayISO } from '../lib/dates'
import { allReminders, closePreviousCycles, visitReminderDate } from '../lib/reminders'
import { goBack, navigate, presetDate } from '../lib/router'
import { useRecord } from '../lib/useRecord'
import { AttachmentsField, useAttachments } from '../components/Attachments'
import { Card, Empty, Fab, Field, FormActions, Input, Loading, Page, Pill, SectionTitle, Select, TextArea } from '../components/ui'
import { ComboInput } from '../components/ComboInput'
import { Highlights } from '../components/Highlights'
import { VisitIllness, emptyIllness, illnessDraftValid, illnessToDraft, type IllnessDraft } from '../components/VisitIllness'
import { Prescriptions, draftToMed, medDraftValid, medToDraft, type MedDraft } from '../components/Prescriptions'

export function VisitsPage({ parts }: { parts: string[] }) {
  // /visite · /visite/nuovo · /visite/<id>
  const [id] = parts
  return id ? <VisitForm id={id} /> : <VisitList />
}

function VisitList() {
  const visits = useLiveQuery(() => db.visits.orderBy('date').reverse().toArray())
  const links = useLiveQuery(async () => ({ illnesses: await db.illnesses.toArray(), meds: await db.medications.toArray() }))
  if (!visits || !links) return <Loading />
  const today = todayISO()
  const upcoming = visits.filter((v) => v.date > today)

  // "In evidenza": visite in programma e richiami in scadenza, in ordine di data
  const highlights = [
    ...upcoming.map((v) => ({
      key: `p${v.id}`,
      date: v.date,
      icon: '🩺',
      title: v.type,
      sub: 'in programma',
      href: `/visite/${v.id}`,
    })),
    ...allReminders([], visits).map((r) => ({
      key: r.key,
      date: r.dueDate,
      icon: '💉',
      title: r.title.replace(/^Richiamo: /, ''),
      sub: 'richiamo',
      href: `/visite/${r.id}`,
    })),
  ]

  return (
    <Page title="Visite mediche" back="/">
      {!visits.length && <Empty>Nessuna visita registrata.<br />Tocca + per aggiungerne una.</Empty>}
      <Highlights items={highlights} />
      {visits.length > 0 && <SectionTitle>Tutte le visite</SectionTitle>}
      <div className="space-y-2">
        {visits.map((v) => (
          <VisitRow
            key={v.id}
            v={v}
            upcoming={v.date > today}
            illness={links.illnesses.find((i) => i.id === v.illnessId)}
            meds={links.meds.filter((m) => m.visitId === v.id)}
          />
        ))}
      </div>
      <Fab to="/visite/nuovo" />
    </Page>
  )
}


function VisitRow({ v, upcoming, illness, meds }: { v: Visit; upcoming?: boolean; illness?: Illness; meds: Medication[] }) {
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
            {v.vet ? ` · ${v.vet}` : ''}
            {v.attachmentIds.length ? ` · 📎 ${v.attachmentIds.length}` : ''}
          </div>
          {(illness || meds.length > 0) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {illness && <Pill color="#ef4444">🤒 {illness.category}</Pill>}
              {meds.map((m) => (
                <Pill key={m.id} color="#f97316">
                  💊 {m.name}
                </Pill>
              ))}
            </div>
          )}
          {v.notes && <p className="mt-1 line-clamp-2 text-sm text-[#c9c9d1]">{v.notes}</p>}
          {visitReminderDate(v) && (
            <div className="mt-1 text-xs text-shiba">💉 richiamo il {formatDate(visitReminderDate(v))}</div>
          )}
        </div>
      </div>
    </Card>
  )
}

function VisitForm({ id }: { id: string }) {
  const rec = useRecord(db.visits, id)
  const data = useLiveQuery(async () => ({
    profile: await getProfile(),
    all: await db.visits.toArray(),
    illnesses: await db.illnesses.toArray(),
    meds: await db.medications.toArray(),
  }))
  if (rec === undefined || !data) return <Loading />
  return <VisitFormInner rec={rec} {...data} />
}

const ILLNESS_TYPE = 'Malattia'
const isIllnessType = (t: string) => t.trim().toLowerCase() === ILLNESS_TYPE.toLowerCase()

function VisitFormInner({
  rec,
  profile,
  all,
  illnesses,
  meds,
}: {
  rec: Visit | null
  profile: Profile
  all: Visit[]
  illnesses: Illness[]
  meds: Medication[]
}) {
  const types = [...new Set([ILLNESS_TYPE, ...profile.visitTypes])]
  const [date, setDate] = useState(rec?.date ?? presetDate(todayISO()))
  const [type, setType] = useState(rec?.type ?? '')
  const [vet, setVet] = useState(rec?.vet ?? '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const [remOn, setRemOn] = useState(!!rec?.reminder)
  const [remAmount, setRemAmount] = useState(String(rec?.reminder?.amount ?? 1))
  const [remUnit, setRemUnit] = useState<IntervalUnit>(rec?.reminder?.unit ?? 'anni')
  const amount = Math.max(1, parseInt(remAmount) || 0)
  const att = useAttachments(rec?.attachmentIds ?? [])

  // episodio di malattia e farmaci prescritti collegati alla visita
  const linkedIllness = illnesses.find((i) => i.id === rec?.illnessId)
  const [illness, setIllness] = useState<IllnessDraft>(() => (linkedIllness ? illnessToDraft(linkedIllness) : emptyIllness(date)))
  const linkedMeds = rec ? meds.filter((m) => m.visitId === rec.id) : []
  const [drafts, setDrafts] = useState<MedDraft[]>(() => linkedMeds.map(medToDraft))
  // visita "Malattia": sezione completa dell'episodio; altri tipi (es. ecografia): solo collegamento facoltativo
  const showIllness = isIllnessType(type)
  const [linkOn, setLinkOn] = useState(!!linkedIllness && !isIllnessType(rec?.type ?? ''))
  const known = [...meds].sort((a, b) => b.startDate.localeCompare(a.startDate))

  // la data della visita fa da inizio predefinito per un nuovo episodio e per i farmaci appena aggiunti
  const changeDate = (d: string) => {
    if (!illness.id && illness.startDate === date) setIllness({ ...illness, startDate: d })
    setDrafts(drafts.map((m) => (!m.existing && m.startDate === date ? { ...m, startDate: d } : m)))
    setDate(d)
  }

  const sameType = (v: Visit, t: string) => v.type.trim().toLowerCase() === t.trim().toLowerCase()

  /** Scegliendo un tipo che aveva già un richiamo (es. "Vaccino"), il promemoria si attiva con lo stesso intervallo */
  const changeType = (t: string) => {
    setType(t)
    if (rec || remOn) return
    const prev = all
      .filter((v) => v.reminder && sameType(v, t))
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    if (prev?.reminder) {
      setRemOn(true)
      setRemAmount(String(prev.reminder.amount))
      setRemUnit(prev.reminder.unit)
    }
  }

  /** C'è già una visita successiva dello stesso tipo fatta in prossimità del richiamo? */
  const superseded = (id: string) => {
    const due = addInterval(date, amount, remUnit)
    return !!due && all.some((v) => v.id !== id && sameType(v, type) && v.date > date && v.date >= addInterval(due, -3, 'mesi'))
  }

  const save = async () => {
    const attachmentIds = await att.commit()
    const id = rec?.id ?? newId()

    // episodio: nuovo o aggiornamento di quello scelto (stesso record della sezione Malattie)
    let illnessId: string | undefined = !showIllness && linkOn ? illness.id : undefined
    if (showIllness) {
      const prev = illnesses.find((i) => i.id === illness.id)
      illnessId = prev?.id ?? newId()
      await db.illnesses.put({
        id: illnessId,
        createdAt: prev?.createdAt ?? Date.now(),
        category: illness.category.trim(),
        description: illness.description.trim() || undefined,
        startDate: illness.startDate,
        endDate: illness.endDate || undefined,
        severity: illness.severity || undefined,
        notes: prev?.notes,
        attachmentIds: prev?.attachmentIds ?? [],
      })
    }

    // farmaci prescritti: salvati nella sezione Farmaci con il collegamento alla visita
    for (const d of drafts) {
      const med = draftToMed(d, { visitId: id, illnessId })
      await db.medications.put(med)
      await closePreviousCycles(med)
    }
    for (const m of linkedMeds) if (!drafts.some((d) => d.existing?.id === m.id)) await deleteWithAttachments('medications', m.id)

    await db.visits.put({
      id,
      createdAt: rec?.createdAt ?? Date.now(),
      date,
      illnessId,
      type: type.trim(),
      vet: vet.trim() || undefined,
      notes: notes.trim() || undefined,
      // se cambia l'intervallo l'avviso torna attivo; se dopo questa visita ce n'è già
      // una dello stesso tipo vicino alla scadenza (es. vaccino 2025 inserito dopo il 2026), il richiamo è già fatto
      reminder: remOn
        ? {
            amount,
            unit: remUnit,
            done:
              superseded(id) ||
              (rec?.reminder?.amount === amount && rec.reminder.unit === remUnit ? rec.reminder.done : undefined) ||
              undefined,
          }
        : undefined,
      attachmentIds,
    })
    // una visita dello stesso tipo fatta in prossimità del richiamo (da 3 mesi prima in poi)
    // completa il promemoria della visita precedente: non resta un avviso "scaduto"
    for (const v of all) {
      if (v.id === id || !sameType(v, type) || !v.reminder || v.reminder.done || v.date >= date) continue
      const due = addInterval(v.date, v.reminder.amount, v.reminder.unit)
      if (date >= addInterval(due, -3, 'mesi')) await db.visits.update(v.id, { reminder: { ...v.reminder, done: true } })
    }
    goBack('/visite')
  }

  return (
    <Page title={rec ? 'Modifica visita' : 'Nuova visita'} back="/visite">
      <div className="space-y-4">
        <Field label="Tipo di visita">
          <ComboInput value={type} onChange={changeType} options={types} placeholder="es. Controllo" />
        </Field>
        <Field label="Data" hint="Puoi inserire anche una visita futura: comparirà nel calendario Google “Tokyo”.">
          <Input type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
        </Field>
        <Field label="Veterinario / clinica">
          <Input value={vet} onChange={(e) => setVet(e.target.value)} placeholder="facoltativo" />
        </Field>
        <Field label="Note">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Esito, indicazioni del veterinario…" />
        </Field>
        {showIllness ? (
          <VisitIllness
            key="malattia"
            value={illness}
            onChange={setIllness}
            episodes={illnesses}
            suggestions={illnessSuggestions(profile)}
            visitDate={date}
          />
        ) : (
          <Card className="space-y-3 border border-line bg-transparent">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">🤒 Collega a un episodio di malattia</span>
                <span className="block text-xs text-muted">Per esami e controlli legati a una malattia già registrata (es. un’ecografia)</span>
              </span>
              <input
                type="checkbox"
                checked={linkOn}
                onChange={(e) => {
                  setLinkOn(e.target.checked)
                  if (e.target.checked && !illness.id) setIllness(emptyIllness(date))
                }}
                className="size-6 accent-shiba"
              />
            </label>
            {linkOn && (
              <VisitIllness
                key="collegamento"
                linkOnly
                value={illness}
                onChange={setIllness}
                episodes={illnesses}
                suggestions={[]}
                visitDate={date}
              />
            )}
          </Card>
        )}
        <Prescriptions drafts={drafts} onChange={setDrafts} visitDate={date} known={known} />
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
        canSave={
          !!type.trim() &&
          !!date &&
          (showIllness ? illnessDraftValid(illness) : !linkOn || !!illness.id) &&
          drafts.every(medDraftValid)
        }
        onDelete={rec ? () => deleteVisit(rec, linkedIllness, linkedMeds) : undefined}
      />
    </Page>
  )
}

/** Elimina la visita chiedendo cosa fare dell'episodio e dei farmaci collegati */
async function deleteVisit(v: Visit, illness: Illness | undefined, meds: Medication[]) {
  if (illness || meds.length) {
    const what = [illness && `l’episodio “${illness.category}”`, meds.length && `${meds.length === 1 ? 'il farmaco' : `i ${meds.length} farmaci`} prescritti`]
      .filter(Boolean)
      .join(' e ')
    if (confirm(`Eliminare anche ${what}?\n\nOK = elimina anche loro · Annulla = tienili nelle rispettive sezioni`)) {
      if (illness) await deleteWithAttachments('illnesses', illness.id)
      for (const m of meds) await deleteWithAttachments('medications', m.id)
    } else {
      for (const m of meds) await db.medications.update(m.id, { visitId: undefined })
    }
  }
  await deleteWithAttachments('visits', v.id)
  goBack('/visite')
}
