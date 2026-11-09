import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { useEffect, useState } from 'react'

// Configurazione pubblica dell'app web Firebase (non è un dato segreto)
const firebaseConfig = {
  apiKey: 'AIzaSyB6ZgC9zculOz7Jg6ijtJweMc9lDxLxHMU',
  authDomain: 'tokyo-9de39.firebaseapp.com',
  projectId: 'tokyo-9de39',
  storageBucket: 'tokyo-9de39.firebasestorage.app',
  messagingSenderId: '134418684459',
  appId: '1:134418684459:web:5301fd3468c4651ad0e86e',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
auth.languageCode = 'it'

// Firestore con cache locale persistente: l'app funziona anche offline
export const fs = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// solo per i test in locale con gli emulatori Firebase (VITE_EMULATOR=1)
if (import.meta.env.VITE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(fs, '127.0.0.1', 8080)
  // accesso di prova accettato solo dall'emulatore
  ;(window as unknown as Record<string, unknown>).__emuSignIn = (email: string) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })))
}

/** Permessi Google richiesti: solo i file creati dall'app su Drive + calendari */
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
]

function provider(hint?: string | null) {
  const p = new GoogleAuthProvider()
  SCOPES.forEach((s) => p.addScope(s))
  if (hint) p.setCustomParameters({ login_hint: hint })
  return p
}

// ---- token di accesso alle API Google (Drive, Calendar), valido ~1 ora ----

const TOKEN_KEY = 'tokyo-google-token'
let token: { value: string; exp: number } | null = null
try {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (raw) token = JSON.parse(raw)
} catch {
  /* storage non disponibile */
}

function storeToken(cred: UserCredential) {
  const value = GoogleAuthProvider.credentialFromResult(cred)?.accessToken
  if (!value) return
  token = { value, exp: Date.now() + 55 * 60_000 }
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  } catch {
    /* ignora */
  }
  tokenListeners.forEach((l) => l())
}

export function clearToken() {
  token = null
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignora */
  }
  tokenListeners.forEach((l) => l())
}

const tokenListeners = new Set<() => void>()
export const onTokenChange = (l: () => void) => (tokenListeners.add(l), () => tokenListeners.delete(l))

/** Token valido senza interazione, oppure null */
export const currentToken = () => (token && token.exp > Date.now() ? token.value : null)

/** Rinnova il token con un popup Google (va chiamato da un tocco dell'utente) */
export async function renewToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  storeToken(await reauthenticateWithPopup(user, provider(user.email)))
  return currentToken()
}

export async function signIn() {
  storeToken(await signInWithPopup(auth, provider()))
}

export async function signOut() {
  clearToken()
  await fbSignOut(auth)
}

/** undefined = stato ancora sconosciuto, null = non autenticato */
export function useUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(auth.currentUser ?? undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  return user
}
