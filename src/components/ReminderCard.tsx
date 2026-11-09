import { formatDate } from '../lib/dates'
import { archiveReminder, reminderText, type DueReminder } from '../lib/reminders'
import { navigate } from '../lib/router'
import { Button, Card } from './ui'

export function ReminderCard({ r, compact }: { r: DueReminder; compact?: boolean }) {
  const urgent = r.daysLeft <= 7
  return (
    <Card className={urgent ? 'ring-1 ring-shiba/60' : ''} onClick={compact ? () => navigate(r.kind === 'med' ? '/farmaci' : '/visite') : undefined}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{r.daysLeft <= 0 ? '⏰' : r.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{r.title}</div>
          <div className={`text-sm ${urgent ? 'text-shiba' : 'text-muted'}`}>
            {reminderText(r.daysLeft)} · {formatDate(r.dueDate)}
          </div>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="ghost" className="py-2 text-sm" onClick={() => archiveReminder(r)}>
            Archivia avviso
          </Button>
          <Button className="py-2 text-sm" onClick={() => navigate(r.startHref)}>
            {r.startLabel}
          </Button>
        </div>
      )}
    </Card>
  )
}
