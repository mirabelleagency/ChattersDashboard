const TOKEN_STORAGE_KEY = 'chatters-dashboard-access-token'

let token: string | null = null

if (typeof window !== 'undefined') {
  token = window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setToken(t: string) {
  token = t
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, t)
  }
}

export function getToken(): string | null {
  return token
}

export function clearToken() {
  token = null
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

// In dev, leave VITE_API_URL undefined to use Vite's proxy (relative URLs).
// In prod, set VITE_API_URL to your backend base URL.
const BASE_URL = import.meta.env.VITE_API_URL || ''

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  // Ensure cookies are sent for refresh endpoint flows
  const fetchOptions: RequestInit = { ...options, headers, credentials: 'include' }

  const res = await fetch(`${BASE_URL}${path}`, fetchOptions)
  if (res.status === 401) {
    // Try a silent refresh using the refresh cookie
    try {
      const r = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (r.ok) {
        const body = await r.json()
        if (body.access_token) {
          setToken(body.access_token)
          // retry original request with the new token
          headers['Authorization'] = `Bearer ${body.access_token}`
          const retry = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
          if (!retry.ok) {
            const text = await retry.text()
            throw new Error(text || 'Request failed after refresh')
          }
          const ct2 = retry.headers.get('content-type') || ''
          if (ct2.includes('application/json')) return retry.json()
          // @ts-ignore
          return undefined
        }
      }
    } catch (e) {
      // fallthrough to clearing token
    }
    // token invalid or refresh failed
    token = null
    // throw a specific error so caller can react (e.g. redirect to /login)
    const err: any = new Error('Unauthorized')
    err.name = 'UnauthorizedError'
    throw err
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Request failed')
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  // fallback
  // @ts-ignore
  return undefined
}
