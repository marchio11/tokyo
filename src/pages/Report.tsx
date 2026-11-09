import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getProfile } from '../db'
import { addInterval, ageLabel, daysBetween, formatDate, periodLabel, todayISO } from '../lib/dates'
import { Button, Loading, Page, Segmented } from '../components/ui'

type Range = '3' | '6' | '12' | 'tutto'

/** Riepilogo stampabile / salvabile in PDF tramite la stampa del browser */
export function ReportPage() {
  const [range, setRange] = useState<Range>('6')
  const data = useLiveQuery(async () => ({
    profile: await getProfile(),
    visits: await db.visits.orderBy('date').reverse().toArray(),
    illnesses: await db.illnesses.orderBy('startDate').reverse().toArray(),
    medications: await db.medications.orderBy('startDate').reverse().toArray(),
    foods: await db.foods.orderBy('startDate').reverse().toArray(),
    weights: await db.weights.orderBy('date').reverse().toArray(),
  }))
  if (!data) return <Loading />

  const today = todayISO()
  const from = range === 'tutto' ? '0000-00-00' : addInterval(today, -Number(range), 'mesi')
  // un elemento è nel periodo se si sovrappone all'intervallo [from, oggi]
  const overlaps = (start: string, end?: string) => start <= today && (!end || end >= from)
  const { profile: p } = data
  const visits = data.visits.filter((v) => v.date >= from && v.date <= today)
  const illnesses = data.illnesses.filter((i) => overlaps(i.startDate, i.endDate))
  const meds = data.medications.filter((m) => overlaps(m.startDate, m.endDate))
  const foods = data.foods.filter((f) => overlaps(f.startDate, f.endDate))
  const weights = data.weights.filter((w) => w.date >= from && w.date <= today)
  const periodText = range === 'tutto' ? 'Tutto lo storico' : `${formatDate(from)} – ${formatDate(today)}`

  return (
    <Page title="Riepilogo" back="/scheda">
      <div className="no-print mb-4 space-y-3">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: '3', label: '3 mesi' },
            { value: '6', label: '6 mesi' },
            { value: '12', label: '1 anno' },
            { value: 'tutto', label: 'Tutto' },
          ]}
        />
        <Button className="w-full" onClick={() => window.print()}>
          📄 Salva PDF / Condividi
        </Button>
        <p className="text-center text-xs text-muted">Nella finestra di stampa scegli “Salva come PDF”.</p>
      </div>

      <article className="report rounded-2xl bg-white p-5 text-[13px] leading-snug text-neutral-900">
        <header className="mb-4 border-b-2 border-[#f28c28] pb-3">
          <h1 className="text-xl font-bold">Riepilogo sanitario – {p.name}</h1>
          <p className="text-neutral-600">
            {p.breed}
            {p.sex ? ` · ${p.sex}` : ''}
            {p.birthDate ? ` · nato il ${formatDate(p.birthDate)} (${ageLabel(p.birthDate)})` : ''}
            {p.microchip ? ` · microchip ${p.microchip}` : ''}
          </p>
          <p className="text-neutral-600">Periodo: {periodText}</p>
          {p.allergies && <p className="mt-1"><b>Allergie/intolleranze:</b> {p.allergies}</p>}
        </header>

        <Section title="Malattie" empty={!illnesses.length}>
          {illnesses.map((i) => (
            <Row key={i.id} title={i.category} meta={periodLabel(i.startDate, i.endDate) + (i.endDate ? ` (${daysBetween(i.startDate, i.endDate) + 1} gg)` : '')}>
              {[i.severity && `gravità ${i.severity}`, i.description, i.notes].filter(Boolean).join(' · ')}
            </Row>
          ))}
        </Section>

        <Section title="Visite" empty={!visits.length}>
          {visits.map((v) => (
            <Row key={v.id} title={v.type} meta={formatDate(v.date) + (v.vet ? ` · ${v.vet}` : '')}>
              {v.notes}
            </Row>
          ))}
        </Section>

        <Section title="Farmaci, integratori e antiparassitari" empty={!meds.length}>
          {meds.map((m) => (
            <Row key={m.id} title={`${m.name} (${m.kind})`} meta={periodLabel(m.startDate, m.endDate)}>
              {[m.dosage, m.frequency, m.notes].filter(Boolean).join(' · ')}
            </Row>
          ))}
        </Section>

        <Section title="Alimentazione" empty={!foods.length}>
          {foods.map((f) => (
            <Row key={f.id} title={`${f.name} (${f.kind})`} meta={periodLabel(f.startDate, f.endDate)}>
              {f.notes}
            </Row>
          ))}
        </Section>

        <Section title="Peso" empty={!weights.length}>
          <table className="w-full">
            <tbody>
              {weights.map((w) => (
                <tr key={w.id} className="border-b border-neutral-200">
                  <td className="w-32 py-1 pr-3">{formatDate(w.date)}</td>
                  <td className="w-24 py-1 pr-3 font-medium">{w.kg.toLocaleString('it-IT')} kg</td>
                  <td className="py-1 text-neutral-600">{w.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <footer className="mt-4 text-[11px] text-neutral-500">Generato il {formatDate(today)} con l’app Tokyo</footer>
      </article>
    </Page>
  )
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid-page">
      <h2 className="mb-1.5 text-[15px] font-bold text-[#c2650c]">{title}</h2>
      {empty ? <p className="text-neutral-500">Nessun dato nel periodo.</p> : children}
    </section>
  )
}

function Row({ title, meta, children }: { title: string; meta: string; children?: ReactNode }) {
  return (
    <div className="mb-1.5 break-inside-avoid border-l-2 border-neutral-300 pl-2">
      <div>
        <b>{title}</b> <span className="text-neutral-600">— {meta}</span>
      </div>
      {children && <div className="text-neutral-700">{children}</div>}
    </div>
  )
}
