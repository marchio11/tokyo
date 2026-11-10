import { IconCalendar, IconHome, IconPaw, IconScale } from './icons'

const ITEMS = [
  { path: '', label: 'Home', Icon: IconHome },
  { path: 'calendario', label: 'Calendario', Icon: IconCalendar },
  { path: 'peso', label: 'Peso', Icon: IconScale },
  { path: 'scheda', label: 'Tokyo', Icon: IconPaw },
]

export function BottomNav({ current }: { current: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {ITEMS.map(({ path, label, Icon }) => {
          const active = current === path
          return (
            <a
              key={label}
              href={`#/${path}`}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${active ? 'text-shiba' : 'text-muted'}`}
            >
              <Icon width={24} height={24} />
              {label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
