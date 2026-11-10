import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatDate, periodLabel, todayISO } from '../lib/dates'
import { navigate } from '../lib/router'
import { Card, Empty, Loading, Page, SectionTitle } from '../components/ui'

/** Testo senza accenti e in minuscolo, con la mappa delle posizioni nel testo originale */
function normalize(text: string) {
  let norm = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const n = text[i].normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    for (const ch of n) {
      norm += ch
      map.push(i)
    }
  }
  return { norm, map }
}
const norm = (t: string) => normalize(t).norm

/** Estratto del testo attorno alla prima corrispondenza (per le note lunghe) */
function snippet(text: string, q: string) {
  const { norm: n, map } = normalize(text)
  const idx = n.indexOf(q)
  if (idx < 0 || text.length <= 120) return text
  const start = Math.max(0, map[idx] - 40)
  const end = Math.min(text.length, map[idx] + q.length + 70)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

/** Evidenzia le parti del testo che corrispondono alla ricerca */
function Mark({ text, q }: { text: string; q: string }) {
  const { norm: n, map } = normalize(text)
  const parts: ReactNode[] = []
  let last = 0
  let from = 0
  let idx: number
  while (q && (idx = n.indexOf(q, from)) !== -1) {
    const start = map[idx]
    const end = map[idx + q.length - 1] + 1
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <mark key={start} className="rounded bg-shiba/30 px-0.5 text-[#ffd2a6]">
        {text.slice(start, end)}
      </mark>,
    )
    last = end
    from = idx + q.length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

interface Hit {
  key: string
  date: string
  title: string
  sub: string
  /** campi testuali in cui cercare (il primo che corrisponde viene mostrato come estratto) */
  fields: (string | undefined)[]
  href: string
  color: string
}

const SECTIONS: { id: string; label: string }[] = [
  { id: 'illness', label: 'Malattie' },
  { id: 'med', label: 'Farmaci e integratori' },
  { id: 'visit', label: 'Visite' },
  { id: 'food', label: 'Alimentazione' },
  { id: 'weight', label: 'Pesate' },
]

export function SearchPage() {
  const [query, setQuery] = useState('')
  const data = useLiveQuery(async () => {
    const [illnesses, meds, visits, foods, weights, atts] = await Promise.all([
      db.illnesses.toArray(),
      db.medications.toArray(),
      db.visits.toArray(),
      db.foods.toArray(),
      db.weights.toArray(),
      db.attachments.toArray(),
    ])
    const attName = new Map(atts.map((a) => [a.id, a.name]))
    const names = (ids: string[]) => ids.map((id) => attName.get(id)).filter(Boolean).join(' ')
    // disturbo collegato a una visita (e ai farmaci prescritti in quella visita)
    const illnessOf = new Map(illnesses.map((i) => [i.id, i.category]))
    const visitIllness = new Map(visits.map((v) => [v.id, v.illnessId ? illnessOf.get(v.illnessId) : undefined]))
    const all: (Hit & { section: string; medName?: string; start?: string; end?: string })[] = [
      ...illnesses.map((i) => ({
        section: 'illness',
        key: i.id,
        date: i.startDate,
        title: i.category,
        sub: periodLabel(i.startDate, i.endDate),
        fields: [i.category, i.description, i.notes, i.severity && `gravità ${i.severity}`, names(i.attachmentIds)],
        href: `/malattie/${i.id}`,
        color: '#ef4444',
      })),
      ...meds.map((m) => ({
        section: 'med',
        key: m.id,
        date: m.startDate,
        title: m.name,
        sub: `${m.kind} · ${periodLabel(m.startDate, m.endDate)}`,
        fields: [
          m.name,
          m.dosage,
          m.frequency,
          m.notes,
          m.kind,
          names(m.attachmentIds),
          (m.illnessId && illnessOf.get(m.illnessId) && `per ${illnessOf.get(m.illnessId)}`) ||
            (m.visitId && visitIllness.get(m.visitId) && `per ${visitIllness.get(m.visitId)}`),
        ],
        href: `/farmaci/${m.id}`,
        color: m.kind === 'farmaco' ? '#f97316' : m.kind === 'integratore' ? '#22c55e' : '#14b8a6',
        medName: m.name,
        start: m.startDate,
        end: m.endDate,
      })),
      ...visits.map((v) => ({
        section: 'visit',
        key: v.id,
        date: v.date,
        title: v.type,
        sub: [formatDate(v.date), v.vet].filter(Boolean).join(' · '),
        fields: [v.type, v.vet, v.notes, names(v.attachmentIds), visitIllness.get(v.id) && `per ${visitIllness.get(v.id)}`],
        href: `/visite/${v.id}`,
        color: '#3b82f6',
      })),
      ...foods.map((f) => ({
        section: 'food',
        key: f.id,
        date: f.startDate,
        title: f.name,
        sub: `${f.kind} · ${periodLabel(f.startDate, f.endDate)}`,
        fields: [f.name, f.kind, f.notes],
        href: `/cibo/${f.id}`,
        color: '#a855f7',
      })),
      ...weights.map((w) => ({
        section: 'weight',
        key: w.id,
        date: w.date,
        title: `${w.kg.toLocaleString('it-IT')} kg`,
        sub: formatDate(w.date),
        fields: [w.notes],
        href: `/peso/${w.id}`,
        color: '#eab308',
      })),
    ]
    return all
  })

  const q = norm(query.trim())
  const results = useMemo(() => {
    if (!data || q.length < 2) return []
    return data
      .map((h) => ({ ...h, match: h.fields.find((f) => f && norm(f).includes(q)) }))
      .filter((h) => h.match !== undefined)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [data, q])

  // riepilogo dei cicli per ogni prodotto il cui nome corrisponde alla ricerca
  const summaries = useMemo(() => {
    const byName = new Map<string, { name: string; starts: string[]; ongoing: boolean }>()
    for (const r of results) {
      if (r.section !== 'med' || !r.medName || !norm(r.medName).includes(q)) continue
      const k = norm(r.medName)
      const s = byName.get(k) ?? { name: r.medName, starts: [], ongoing: false }
      s.starts.push(r.start!)
      if (!r.end || r.end >= todayISO()) s.ongoing = s.ongoing || r.start! <= todayISO()
      byName.set(k, s)
    }
    return [...byName.values()]
  }, [results, q])

  if (!data) return <Loading />
  return (
    <Page title="Cerca" back="/">
      <div>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">🔍</span>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="es. otite, cobalafolic, Rossi…"
            className="w-full rounded-xl border border-line bg-card py-3 pr-3 pl-10 text-[#ececf1] outline-none placeholder:text-muted/60 focus:border-shiba"
          />
        </div>
      </div>

      {q.length < 2 ? (
        <p className="px-1 pt-4 text-sm text-muted">
          Cerca in malattie, farmaci, visite, alimentazione e pesate: nomi, descrizioni, note, veterinari e nomi degli allegati.
        </p>
      ) : results.length === 0 ? (
        <Empty>Nessun risultato per “{query.trim()}”.</Empty>
      ) : (
        <>
          <p className="px-1 pt-2 text-sm text-muted">
            {results.length} {results.length === 1 ? 'risultato' : 'risultati'}
          </p>
          {summaries.map((s) => {
            const starts = [...s.starts].sort()
            return (
              <Card key={s.name} className="mt-3 border border-ev-drug/40">
                <div className="font-medium">💊 {s.name}</div>
                <div className="text-sm text-muted">
                  {starts.length} {starts.length === 1 ? 'ciclo' : 'cicli'}
                  {starts.length > 1 ? ` · il primo il ${formatDate(starts[0])} · l’ultimo il ${formatDate(starts[starts.length - 1])}` : ` · il ${formatDate(starts[0])}`}
                  {s.ongoing ? ' · in corso' : ''}
                </div>
              </Card>
            )
          })}
          {SECTIONS.map((sec) => {
            const hits = results.filter((r) => r.section === sec.id)
            if (!hits.length) return null
            return (
              <div key={sec.id}>
                <SectionTitle>
                  {sec.label} ({hits.length})
                </SectionTitle>
                <div className="space-y-2">
                  {hits.map((h) => (
                    <Card key={h.key} onClick={() => navigate(h.href)}>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ background: h.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            <Mark text={h.title} q={q} />
                          </div>
                          <div className="text-sm text-muted">{h.sub}</div>
                          {h.match && h.match !== h.title && (
                            <p className="mt-1 line-clamp-2 text-sm text-[#c9c9d1]">
                              <Mark text={snippet(h.match, q)} q={q} />
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </Page>
  )
}
