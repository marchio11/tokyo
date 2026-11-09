import { useState } from 'react'
import { signIn } from '../lib/firebase'
import { Button } from '../components/ui'

export function LoginPage() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
      <img src="icon-512.png" alt="" className="size-32 rounded-[28px]" />
      <div>
        <h1 className="text-3xl font-semibold">
          Diario di <span className="text-shiba">Tokyo</span>
        </h1>
        <p className="mt-2 text-muted">Visite, malattie, farmaci, cibo e peso, sincronizzati su tutti i tuoi dispositivi.</p>
      </div>
      <Button
        className="w-full max-w-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            await signIn()
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Accesso in corso…' : 'Accedi con Google'}
      </Button>
      <p className="max-w-xs text-xs text-muted">
        L’app usa solo i file che crea lei su Google Drive (cartella “Tokyo”) e il calendario “Tokyo”.
      </p>
      {error && <p className="max-w-xs text-sm text-red-400">{error}</p>}
    </div>
  )
}
