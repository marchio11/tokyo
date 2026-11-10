import { DetailCard, DetailPage, DetailRow, DetailSection, LinkRow } from '../components/Detail'
import { SavedAttachments } from '../components/Attachments'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, illnessSuggestions, deleteWithAttachments, getProfile, newId, type Illness, type Medication, type Severity, type Visit } from '../db'
import { daysBetween, formatDate, periodLabel, todayISO } from '../lib/dates'
import { goBack, navigate, presetDate } from '../lib/router'
import { useRecord } from '../lib/useRecord'
import { AttachmentsField, useAttachments } from '../components/Attachments'
import { ComboInput } from '../components/ComboInput'
import { IllnessHistory } from '../components/Links'
import { Prescriptions, draftToMed, medDraftValid, medToDraft, type MedDraft } from '../components/Prescriptions'
import { closePreviousCycles } from '../lib/reminders'
import { Card, Empty, Fab, Field, FormActions, Input, Loading, Page, Pill, Segmented, TextArea } from '../components/ui'

const SEVERITY_COLOR: Record<Severity, string> = { lieve: '#eab308', media: '#f97316', forte: '#ef4444' }

export function IllnessesPage({ parts }: { parts: string[] }) {
  // /malattie · /malattie/nuovo · /malattie/<id> (scheda) · /malattie/<id>/modifica
  const [id, sub] = parts
  if (!id) return <IllnessList />
  return id === 'nuovo' || sub === 'modifica' ? <IllnessForm id={id} /> : <IllnessDetail id={id} />
}

function IllnessList() {
  const list = useLiveQuery(() => db.illnesses.orderBy('startDate').reverse().toArray())
  const visits = useLiveQuery(() => db.visits.toArray())
  const [filter, setFilter] = useState('')
  if (!list) return <Loading />
  const categories = [...new Set(list.map((i) => i.category))].sort()
  const shown = filter ? list.filter((i) => i.category === filter) : list
  return (
    <Page title="Malattie" back="/">
      {categories.length > 1 && (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {['', ...categories].map((c) => (
            <button
              key={c || 'all'}
              onClick={() => setFilter(c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${filter === c ? 'border-shiba bg-shiba-soft text-shiba' : 'border-line text-muted'}`}
            >
              {c || 'Tutte'}
            </button>
          ))}
        </div>
      )}
      {!list.length && <Empty>Nessun episodio registrato. 🐕‍🦺<br />Speriamo resti così!</Empty>}
      <div className="space-y-2">
        {shown.map((i) => (
          <Card key={i.id} onClick={() => navigate(`/malattie/${i.id}`)}>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-10 w-1 shrink-0 rounded-full bg-ev-illness" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{i.category}</span>
                  <div className="flex gap-1">
                    {i.severity && <Pill color={SEVERITY_COLOR[i.severity]}>{i.severity}</Pill>}
                    {!i.endDate && <Pill color="#ef4444">in corso</Pill>}
                  </div>
                </div>
                <div className="text-sm text-muted">
                  {periodLabel(i.startDate, i.endDate)}
                  {i.endDate ? ` · ${daysBetween(i.startDate, i.endDate) + 1} gg` : ''}
                  {i.attachmentIds.length ? ` · 📎 ${i.attachmentIds.length}` : ''}
                  {(() => {
                    const n = visits?.filter((v) => v.illnessId === i.id).length ?? 0
                    return n ? ` · 🩺 ${n} ${n === 1 ? 'visita' : 'visite'}` : ''
                  })()}
                </div>
                {i.description && <p className="mt-1 line-clamp-2 text-sm text-[#c9c9d1]">{i.description}</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Fab to="/malattie/nuovo" />
    </Page>
  )
}

function IllnessForm({ id }: { id: string }) {
  const rec = useRecord(db.illnesses, id)
  const data = useLiveQuery(async () => ({
    profile: await getProfile(),
    meds: await db.medications.toArray(),
    visits: await db.visits.toArray(),
  }))
  if (rec === undefined || !data) return <Loading />
  return <IllnessFormInner rec={rec} categories={illnessSuggestions(data.profile)} meds={data.meds} visits={data.visits} />
}

function IllnessFormInner({
  rec,
  categories,
  meds,
  visits,
}: {
  rec: Illness | null
  categories: string[]
  meds: Medication[]
  visits: Visit[]
}) {
  const [category, setCategory] = useState(rec?.category ?? '')
  const [description, setDescription] = useState(rec?.description ?? '')
  const [startDate, setStartDate] = useState(rec?.startDate ?? presetDate(todayISO()))
  const [endDate, setEndDate] = useState(rec?.endDate ?? '')
  const [severity, setSeverity] = useState<Severity | ''>(rec?.severity ?? '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const att = useAttachments(rec?.attachmentIds ?? [])

  // farmaci dati per questo episodio: direttamente o prescritti nelle visite collegate
  const visitIds = new Set(rec ? visits.filter((v) => v.illnessId === rec.id).map((v) => v.id) : [])
  const linkedMeds = rec ? meds.filter((m) => m.illnessId === rec.id || (!!m.visitId && visitIds.has(m.visitId))) : []
  const [drafts, setDrafts] = useState<MedDraft[]>(() => linkedMeds.map(medToDraft))
  const known = [...meds].sort((a, b) => b.startDate.localeCompare(a.startDate))

  // l'inizio dell'episodio fa da inizio predefinito per i farmaci appena aggiunti
  const changeStart = (d: string) => {
    setDrafts(drafts.map((m) => (!m.existing && m.startDate === startDate ? { ...m, startDate: d } : m)))
    setStartDate(d)
  }

  const validEnd = !endDate || endDate >= startDate

  const save = async () => {
    const attachmentIds = await att.commit()
    const id = rec?.id ?? newId()
    // farmaci: salvati nella sezione Farmaci con il collegamento all'episodio
    for (const d of drafts) {
      const med = draftToMed(d, { illnessId: id })
      await db.medications.put(med)
      await closePreviousCycles(med)
    }
    for (const m of linkedMeds) if (!drafts.some((d) => d.existing?.id === m.id)) await deleteWithAttachments('medications', m.id)
    await db.illnesses.put({
      id,
      createdAt: rec?.createdAt ?? Date.now(),
      category: category.trim(),
      description: description.trim() || undefined,
      startDate,
      endDate: endDate || undefined,
      severity: severity || undefined,
      notes: notes.trim() || undefined,
      attachmentIds,
    })
    goBack('/malattie')
  }

  return (
    <Page title={rec ? 'Modifica episodio' : 'Nuovo episodio'} back="/malattie">
      <div className="space-y-4">
        <Field label="Disturbo">
          <ComboInput value={category} onChange={setCategory} options={categories} placeholder="es. Otite" />
        </Field>
        <Field label="Descrizione">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="es. orecchio destro arrossato" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inizio">
            <Input type="date" value={startDate} onChange={(e) => changeStart(e.target.value)} />
          </Field>
          <Field label="Fine">
            <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="-mt-2 flex items-center justify-between text-xs text-muted">
          <span>{endDate ? (validEnd ? '' : '⚠️ La fine è precedente all’inizio') : 'Senza data di fine l’episodio è considerato in corso'}</span>
          {endDate ? (
            <button className="text-shiba" onClick={() => setEndDate('')}>
              Rimuovi fine
            </button>
          ) : (
            <button className="text-shiba" onClick={() => setEndDate(todayISO())}>
              Guarito oggi
            </button>
          )}
        </div>
        <Field label="Gravità">
          <Segmented
            value={severity}
            onChange={(v) => setSeverity(v === severity ? '' : v)}
            options={[
              { value: 'lieve', label: 'Lieve' },
              { value: 'media', label: 'Media' },
              { value: 'forte', label: 'Forte' },
            ]}
          />
        </Field>
        <Field label="Note">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Prescriptions
          drafts={drafts}
          onChange={setDrafts}
          visitDate={startDate}
          known={known}
          title="Farmaci somministrati"
          hint="Anche quelli dati di tua iniziativa: compariranno nella sezione Farmaci, collegati a questo episodio."
        />
        <AttachmentsField state={att} />
        {rec && <IllnessHistory illnessId={rec.id} />}
      </div>
      <FormActions
        onSave={save}
        canSave={!!category.trim() && !!startDate && validEnd && drafts.every(medDraftValid)}
        onDelete={rec ? () => deleteIllness(rec, meds.filter((m) => m.illnessId === rec.id)) : undefined}
      />
    </Page>
  )
}

/** Elimina l'episodio chiedendo cosa fare dei farmaci collegati */
async function deleteIllness(i: Illness, meds: Medication[]) {
  if (meds.length) {
    const what = meds.length === 1 ? `il farmaco “${meds[0].name}”` : `i ${meds.length} farmaci collegati`
    if (confirm(`Eliminare anche ${what}?\n\nOK = elimina anche i farmaci · Annulla = tienili nella sezione Farmaci`)) {
      for (const m of meds) await deleteWithAttachments('medications', m.id)
    } else {
      for (const m of meds) await db.medications.update(m.id, { illnessId: undefined })
    }
  }
  await deleteWithAttachments('illnesses', i.id)
  goBack('/malattie')
}

/** Scheda di sola lettura dell'episodio */
function IllnessDetail({ id }: { id: string }) {
  const data = useLiveQuery(async () => {
    const i = (await db.illnesses.get(id)) ?? null
    const visits = (await db.visits.filter((v) => v.illnessId === id).toArray()).sort((a, b) => a.date.localeCompare(b.date))
    const vIds = new Set(visits.map((v) => v.id))
    const meds = (await db.medications.filter((m) => m.illnessId === id || (!!m.visitId && vIds.has(m.visitId))).toArray()).sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    )
    return { i, visits, meds }
  }, [id])
  return (
    <DetailPage title={data?.i?.category ?? 'Episodio'} back="/malattie" editHref={`/malattie/${id}/modifica`} record={data?.i}>
      {(i) => (
        <>
          <DetailCard accent="#ef4444">
            <DetailRow label="Periodo">
              {periodLabel(i.startDate, i.endDate)}
              {i.endDate ? ` · ${daysBetween(i.startDate, i.endDate) + 1} ${daysBetween(i.startDate, i.endDate) === 0 ? 'giorno' : 'giorni'}` : ''}
            </DetailRow>
            <DetailRow label="Descrizione">{i.description}</DetailRow>
            <DetailRow label="Gravità">{i.severity && i.severity[0].toUpperCase() + i.severity.slice(1)}</DetailRow>
            <DetailRow label="Note">{i.notes}</DetailRow>
          </DetailCard>
          {!!data?.meds.length && (
            <DetailSection title="Farmaci somministrati">
              <div className="space-y-1.5">
                {data.meds.map((m) => (
                  <LinkRow
                    key={m.id}
                    color="#f97316"
                    title={m.name}
                    sub={[periodLabel(m.startDate, m.endDate), m.dosage, m.frequency].filter(Boolean).join(' · ')}
                    href={`/farmaci/${m.id}`}
                  />
                ))}
              </div>
            </DetailSection>
          )}
          {!!data?.visits.length && (
            <DetailSection title="Visite per questo episodio">
              <div className="space-y-1.5">
                {data.visits.map((v) => (
                  <LinkRow key={v.id} color="#3b82f6" title={v.type} sub={[formatDate(v.date), v.vet].filter(Boolean).join(' · ')} href={`/visite/${v.id}`} />
                ))}
              </div>
            </DetailSection>
          )}
          {i.attachmentIds.length > 0 && (
            <DetailSection title="Allegati">
              <SavedAttachments ids={i.attachmentIds} />
            </DetailSection>
          )}
        </>
      )}
    </DetailPage>
  )
}
