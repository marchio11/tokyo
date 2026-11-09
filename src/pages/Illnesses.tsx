import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteWithAttachments, getProfile, newId, type Illness, type Severity } from '../db'
import { daysBetween, periodLabel, todayISO } from '../lib/dates'
import { goBack, navigate } from '../lib/router'
import { useRecord } from '../lib/useRecord'
import { AttachmentsField, useAttachments } from '../components/Attachments'
import { ComboInput } from '../components/ComboInput'
import { Card, Empty, Fab, Field, FormActions, Input, Loading, Page, Pill, Segmented, TextArea } from '../components/ui'

const SEVERITY_COLOR: Record<Severity, string> = { lieve: '#eab308', media: '#f97316', forte: '#ef4444' }

export function IllnessesPage({ id }: { id?: string }) {
  return id ? <IllnessForm id={id} /> : <IllnessList />
}

function IllnessList() {
  const list = useLiveQuery(() => db.illnesses.orderBy('startDate').reverse().toArray())
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
  const profile = useLiveQuery(getProfile)
  if (rec === undefined || !profile) return <Loading />
  return <IllnessFormInner rec={rec} categories={profile.illnessCategories} />
}

function IllnessFormInner({ rec, categories }: { rec: Illness | null; categories: string[] }) {
  const [category, setCategory] = useState(rec?.category ?? '')
  const [description, setDescription] = useState(rec?.description ?? '')
  const [startDate, setStartDate] = useState(rec?.startDate ?? todayISO())
  const [endDate, setEndDate] = useState(rec?.endDate ?? '')
  const [severity, setSeverity] = useState<Severity | ''>(rec?.severity ?? '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const att = useAttachments(rec?.attachmentIds ?? [])

  const validEnd = !endDate || endDate >= startDate

  const save = async () => {
    const attachmentIds = await att.commit()
    await db.illnesses.put({
      id: rec?.id ?? newId(),
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
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
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
        <AttachmentsField state={att} />
      </div>
      <FormActions
        onSave={save}
        canSave={!!category.trim() && !!startDate && validEnd}
        onDelete={rec ? async () => (await deleteWithAttachments('illnesses', rec.id), goBack('/malattie')) : undefined}
      />
    </Page>
  )
}
