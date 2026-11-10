import { daysBetween, formatDate, todayISO } from '../lib/dates'
import { navigate } from '../lib/router'
import { Card, SectionTitle } from './ui'

export interface Highlight {
  key: string
  date: string
  icon: string
  title: string
  sub: string
  href: string
}

const daysLabel = (n: number) =>
  n < 0 ? `scaduto da ${-n} ${n === -1 ? 'giorno' : 'giorni'}` : n === 0 ? 'oggi' : n === 1 ? 'domani' : `tra ${n} giorni`

/** Riquadro "In evidenza": prossime scadenze in righe compatte, senza pulsanti */
export function Highlights({ items }: { items: Highlight[] }) {
  if (!items.length) return null
  const today = todayISO()
  return (
    <>
      <SectionTitle>In evidenza</SectionTitle>
      <div className="space-y-2">
        {[...items]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((h) => {
            const n = daysBetween(today, h.date)
            return (
              <Card key={h.key} onClick={() => navigate(h.href)} className={n <= 7 ? 'ring-1 ring-shiba/60' : ''}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{h.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{h.title}</div>
                    <div className="text-sm text-muted">{h.sub}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-medium text-shiba">{formatDate(h.date)}</div>
                    <div className="text-xs text-muted">{daysLabel(n)}</div>
                  </div>
                </div>
              </Card>
            )
          })}
      </div>
    </>
  )
}
