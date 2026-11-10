import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getProfile, illnessSuggestions, type Profile } from '../db'
import { ageLabel, formatDate } from '../lib/dates'
import { exportBackup, importBackup } from '../lib/backup'
import { navigate } from '../lib/router'
import { auth, signOut } from '../lib/firebase'
import { runGoogleSync } from '../lib/cloud'
import { useStatus } from '../lib/status'
import { useErrors } from '../lib/diag'
import { Documents } from '../components/Documents'
import { Button, Card, Field, Input, Loading, Page, SectionTitle, TextArea } from '../components/ui'

export function ProfilePage() {
  const profile = useLiveQuery(getProfile)
  if (!profile) return <Loading />
  return <ProfileInner key={profile.name} profile={profile} />
}

function ProfileInner({ profile }: { profile: Profile }) {
  const [p, setP] = useState(profile)
  const [saved, setSaved] = useState(false)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setP((x) => ({ ...x, [k]: v }))
    setSaved(false)
  }
  const save = async () => {
    // i documenti si salvano a parte: si conserva l'elenco attuale
    const current = await getProfile()
    await db.profile.put({ ...p, documentIds: current.documentIds })
    setSaved(true)
  }

  return (
    <Page title="Scheda di Tokyo">
      <Card className="mb-4 flex items-center gap-4">
        <img src="icon-192.png" alt="" className="size-16 rounded-2xl" />
        <div>
          <div className="text-xl font-semibold">{p.name || 'Tokyo'}</div>
          <div className="text-sm text-muted">
            {p.breed}
            {p.birthDate ? ` · nato il ${formatDate(p.birthDate)} (${ageLabel(p.birthDate)})` : ''}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome">
            <Input value={p.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Razza">
            <Input value={p.breed} onChange={(e) => set('breed', e.target.value)} />
          </Field>
          <Field label="Data di nascita">
            <Input type="date" value={p.birthDate ?? ''} onChange={(e) => set('birthDate', e.target.value || undefined)} />
          </Field>
          <Field label="Sesso">
            <Input value={p.sex ?? ''} onChange={(e) => set('sex', e.target.value)} placeholder="es. maschio" />
          </Field>
        </div>
        <Field label="Microchip">
          <Input value={p.microchip ?? ''} onChange={(e) => set('microchip', e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Allergie / intolleranze note">
          <TextArea value={p.allergies ?? ''} onChange={(e) => set('allergies', e.target.value)} rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Veterinario">
            <Input value={p.vetName ?? ''} onChange={(e) => set('vetName', e.target.value)} />
          </Field>
          <Field label="Telefono vet.">
            <Input type="tel" value={p.vetPhone ?? ''} onChange={(e) => set('vetPhone', e.target.value)} />
          </Field>
        </div>
        {p.vetPhone && (
          <a href={`tel:${p.vetPhone.replace(/\s/g, '')}`} className="block rounded-xl bg-card-2 py-3 text-center text-shiba">
            📞 Chiama il veterinario
          </a>
        )}
        <Field label="Note">
          <TextArea value={p.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <TagEditor
          label="Disturbi monitorati in dashboard"
          hint="Solo questi hanno il contatore “giorni senza…” nella pagina principale."
          values={p.illnessCategories}
          onChange={(v) => set('illnessCategories', v)}
          quick={illnessSuggestions(p)}
        />
        <TagEditor
          label="Disturbi suggeriti nell’inserimento"
          hint="Compaiono come scelte rapide quando registri un nuovo episodio."
          values={illnessSuggestions(p)}
          onChange={(v) => set('illnessSuggestions', v)}
        />
        <TagEditor label="Tipi di visita suggeriti" values={p.visitTypes} onChange={(v) => set('visitTypes', v)} />

        <Button className="w-full" onClick={save}>
          {saved ? '✓ Salvato' : 'Salva scheda'}
        </Button>
      </div>

      <Documents />

      <SectionTitle>Riepilogo</SectionTitle>
      <Card onClick={() => navigate('/riepilogo')}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">📄</span>
          <div className="flex-1">
            <div className="font-medium">Riepilogo sanitario in PDF</div>
            <div className="text-sm text-muted">Malattie, visite, farmaci, cibo e peso di un periodo</div>
          </div>
          <span className="text-muted">›</span>
        </div>
      </Card>

      <SectionTitle>Account e sincronizzazione</SectionTitle>
      <AccountCard />

      <SectionTitle>Backup dei dati</SectionTitle>
      <BackupCard />

      <p className="mt-8 text-center text-xs text-muted">Tokyo · v{__APP_VERSION__} · dati sincronizzati con Firebase e Google Drive</p>
    </Page>
  )
}

function TagEditor({
  label,
  hint,
  values,
  onChange,
  quick = [],
}: {
  label: string
  hint?: string
  values: string[]
  onChange: (v: string[]) => void
  /** valori proposti con un tocco (solo quelli non ancora presenti) */
  quick?: string[]
}) {
  const missing = quick.filter((q) => !values.some((v) => v.toLowerCase() === q.toLowerCase()))
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }
  return (
    <div>
      <span className="block text-sm text-muted">{label}</span>
      {hint && <span className="mb-1.5 block text-xs text-muted/80">{hint}</span>}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-card-2 py-1 pr-1.5 pl-3 text-sm">
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="grid size-5 place-items-center rounded-full text-muted" aria-label={`Rimuovi ${v}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {missing.map((q) => (
            <button key={q} onClick={() => onChange([...values, q])} className="rounded-full border border-dashed border-line px-3 py-1 text-sm text-muted">
              + {q}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Aggiungi…" />
        <Button variant="ghost" onClick={add} className="px-4">
          +
        </Button>
      </div>
    </div>
  )
}

function BackupCard() {
  const [msg, setMsg] = useState('')
  return (
    <Card className="space-y-3">
      <p className="text-sm text-muted">
        I dati sono già salvati nel cloud. Se vuoi, puoi comunque scaricarne una copia completa in un file (contiene anche gli
        allegati presenti su questo dispositivo).
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => exportBackup().then(() => setMsg('Backup scaricato ✓'))}>
          ⬇️ Esporta
        </Button>
        <label className="cursor-pointer rounded-xl bg-card-2 px-4 py-3 text-center active:bg-line">
          ⬆️ Ripristina
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f || !confirm('Il ripristino sostituisce TUTTI i dati attuali. Continuare?')) return
              try {
                await importBackup(f)
                setMsg('Dati ripristinati ✓')
              } catch (err) {
                setMsg(`Errore: ${(err as Error).message}`)
              }
            }}
          />
        </label>
      </div>
      {msg && <p className="text-center text-sm text-shiba">{msg}</p>}
    </Card>
  )
}

function AccountCard() {
  const s = useStatus()
  const errors = useErrors()
  const user = auth.currentUser
  const state = s.busy
    ? '⏳ Sincronizzazione in corso…'
    : s.needsAuth
      ? '🔄 In attesa di collegare Google'
      : s.calendarMissing
        ? '📅 Calendario “Tokyo” non trovato'
        : s.error
          ? `⚠️ ${s.error}`
          : s.lastSync
            ? `✓ Drive e calendario aggiornati alle ${new Date(s.lastSync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
            : '✓ Tutto aggiornato'
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        {user?.photoURL && <img src={user.photoURL} alt="" className="size-10 rounded-full" referrerPolicy="no-referrer" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{user?.displayName}</div>
          <div className="truncate text-sm text-muted">{user?.email}</div>
        </div>
      </div>
      <p className="text-sm text-muted">{state}</p>
      {errors.length > 0 && (
        <details className="text-sm">
          <summary className="text-red-300">⚠️ {errors.length} errori recenti (tocca per vederli)</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-bg p-3 text-xs whitespace-pre-wrap text-red-300 select-text">
            {errors.join('\n')}
          </pre>
        </details>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => runGoogleSync(true)} disabled={s.busy}>
          🔄 Sincronizza
        </Button>
        <Button
          variant="ghost"
          onClick={() => confirm('Vuoi uscire dall’account su questo dispositivo?') && signOut()}
        >
          Esci
        </Button>
      </div>
    </Card>
  )
}
