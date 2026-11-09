import { clearToken, currentToken } from './firebase'

export class AuthNeeded extends Error {
  constructor() {
    super('Serve rinnovare l’accesso a Google')
  }
}

/** fetch verso le API Google con il token corrente; 401 → AuthNeeded */
export async function gfetch(url: string, init: RequestInit = {}): Promise<Response> {
  const tok = currentToken()
  if (!tok) throw new AuthNeeded()
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${tok}` } })
  if (res.status === 401) {
    clearToken()
    throw new AuthNeeded()
  }
  return res
}

export async function gjson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await gfetch(url, init)
  if (!res.ok) throw new Error(`Google API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}
