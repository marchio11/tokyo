import { Component, type ReactNode } from 'react'
import { logError } from '../lib/diag'

/**
 * Se una pagina va in errore mostra un messaggio con le possibili azioni
 * invece di lasciare lo schermo nero.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    logError('Errore nella pagina:', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-6 pt-[max(env(safe-area-inset-top),48px)] pb-28 text-center">
        <div className="text-5xl">🐕‍🦺</div>
        <h1 className="text-xl font-semibold">Ops, qualcosa è andato storto</h1>
        <p className="text-muted">I dati già salvati sono al sicuro. Puoi tornare indietro o ricaricare l’app.</p>
        <pre className="max-h-40 overflow-auto rounded-xl bg-card p-3 text-left text-xs whitespace-pre-wrap text-red-300 select-text">
          {error.message}
        </pre>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="rounded-xl bg-card-2 px-4 py-3"
            onClick={() => {
              this.setState({ error: null })
              history.back()
            }}
          >
            Torna indietro
          </button>
          <button className="rounded-xl bg-shiba px-4 py-3 font-semibold text-black" onClick={() => location.reload()}>
            Ricarica
          </button>
        </div>
      </div>
    )
  }
}
