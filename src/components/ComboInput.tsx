import { Input } from './ui'

/** Campo di testo libero con suggerimenti rapidi a "chip" */
export function ComboInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={`rounded-full border px-3 py-1 text-sm ${
                value === o ? 'border-shiba bg-shiba-soft text-shiba' : 'border-line text-muted active:bg-card'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
