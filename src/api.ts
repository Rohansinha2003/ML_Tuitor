type ApiEnvelope<T> = { data: T } | { error: string; details?: { path: string; message: string }[] }

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'
let accessToken: string | null = null

export class ApiError extends Error {
  status: number
  details?: { path: string; message: string }[]
  constructor(status: number, message: string, details?: { path: string; message: string }[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export const setAccessToken = (token: string | null) => { accessToken = token }

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: ApiEnvelope<T>
  try {
    payload = await response.json() as ApiEnvelope<T>
  } catch {
    throw new ApiError(response.status, 'The server returned an unreadable response')
  }
  if (!response.ok) {
    if ('error' in payload) throw new ApiError(response.status, payload.error, payload.details)
    throw new ApiError(response.status, 'The request could not be completed')
  }
  return 'data' in payload ? payload.data : payload as T
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return null
    const payload = await response.json() as ApiEnvelope<{ accessToken: string }>
    if (!('data' in payload) || typeof payload.data.accessToken !== 'string') return null
    accessToken = payload.data.accessToken
    return accessToken
  } catch {
    return null
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retryAuth = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'The learning service is unavailable. Your guest progress remains on this device.')
  }
  if (response.status === 401 && retryAuth && !path.startsWith('/auth/')) {
    const token = await refreshAccessToken()
    if (token) return apiRequest<T>(path, init, false)
    accessToken = null
  }
  return parseResponse<T>(response)
}

export function apiUrl(path: string) {
  return `${apiBase}${path}`
}
