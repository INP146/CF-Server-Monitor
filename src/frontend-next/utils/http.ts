import { getApiBases } from './config'
import { STORAGE } from './constants'
import {
  AUTH_EXPIRED_EVENT,
  TURNSTILE_EXPIRED_EVENT,
  clearAuthTokenForBase,
  clearTurnstileVerificationForBase,
  getAuthTokenForBase,
  getTurnstileVerificationForBase,
  isAdminLoggedIn,
  setTurnstileVerificationForBase,
} from './auth'

const DEFAULT_ERROR_MESSAGES: Record<number, string> = {
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
}

export interface RequestOptions {
  includeAuth?: boolean
  includeTurnstile?: boolean
  includeTurnstileToken?: boolean
  includeTurnstileVerified?: boolean
  autoRedirect?: boolean
  baseUrl?: string
}

export interface ApiResult<T> {
  data?: T
  error?: string
  code?: string | number
  message?: string
  status: number
  baseUrl: string
  corsError?: boolean
}

type ProgressHandler<T> = (result: ApiResult<T>) => void

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function createHeaders(options: RequestOptions): Headers {
  const {
    includeAuth = true,
    includeTurnstile = true,
    includeTurnstileToken = includeTurnstile,
    includeTurnstileVerified = true,
  } = options
  const headers = new Headers({ 'Content-Type': 'application/json' })

  if (includeAuth) {
    const token = getAuthTokenForBase(options.baseUrl || getApiBases()[0]!)
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  if (includeTurnstile && includeTurnstileToken) {
    const token = localStorage.getItem(STORAGE.TURNSTILE_TOKEN)
    if (token) headers.set('X-Turnstile-Token', token)
  }

  if (includeTurnstileVerified) {
    const verified = getTurnstileVerificationForBase(options.baseUrl || getApiBases()[0]!)
    if (verified) headers.set('X-Turnstile-Verified', verified)
  }

  return headers
}

function dispatchSessionEvent(name: string, baseUrl: string): void {
  window.dispatchEvent(new CustomEvent(name, { detail: { baseUrl } }))
}

async function handleResponse<T>(response: Response, options: RequestOptions): Promise<Omit<ApiResult<T>, 'baseUrl'>> {
  const { autoRedirect = true } = options
  const baseUrl = options.baseUrl || getApiBases()[0]!

  if (response.status === 401) {
    clearAuthTokenForBase(baseUrl)
    if (autoRedirect) dispatchSessionEvent(AUTH_EXPIRED_EVENT, baseUrl)
    return { error: DEFAULT_ERROR_MESSAGES[401], status: response.status }
  }

  if (response.status === 403) {
    localStorage.removeItem(STORAGE.TURNSTILE_TOKEN)
    clearTurnstileVerificationForBase(baseUrl)
    if (autoRedirect) dispatchSessionEvent(TURNSTILE_EXPIRED_EVENT, baseUrl)
    return { error: DEFAULT_ERROR_MESSAGES[403], status: response.status }
  }

  if (!response.ok) {
    let error = DEFAULT_ERROR_MESSAGES[response.status] ?? 'Request failed'
    let code: string | number = response.status
    let message: string | undefined

    try {
      const body = asRecord(await response.json())
      if (typeof body?.message === 'string') message = body.message
      if (typeof body?.error === 'string') error = body.error
      if (typeof body?.code === 'string' || typeof body?.code === 'number') {
        code = body.code
        if (typeof body.error !== 'string' && typeof body.code === 'string') error = body.code
      }
    } catch {
      // Some upstream errors intentionally have an empty or non-JSON body.
    }

    return { error, code, message, status: response.status }
  }

  try {
    const data = await response.json() as T
    const record = asRecord(data)
    if (typeof record?.turnstile_verified === 'string' && record.turnstile_verified) {
      setTurnstileVerificationForBase(baseUrl, record.turnstile_verified)
      localStorage.removeItem(STORAGE.TURNSTILE_TOKEN)
    }
    return { data, status: response.status }
  } catch {
    return { status: response.status }
  }
}

async function request<T>(method: string, url: string, body: unknown, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const baseUrl = options.baseUrl || getApiBases()[0]!
  const resolvedOptions = { ...options, baseUrl }
  try {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: createHeaders(resolvedOptions),
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    })
    return { ...await handleResponse<T>(response, resolvedOptions), baseUrl }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
      baseUrl,
      corsError: error instanceof TypeError,
    }
  }
}

async function requestAll<T>(method: string, url: string, body: unknown, options: RequestOptions): Promise<ApiResult<T>[]> {
  return Promise.all(getApiBases().map((baseUrl) => request<T>(method, url, body, { ...options, baseUrl })))
}

export const http = {
  get<T>(url: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    return request<T>('GET', url, undefined, options)
  },

  post<T>(url: string, body: unknown = {}, options: RequestOptions = {}): Promise<ApiResult<T>> {
    return request<T>('POST', url, body, options)
  },

  put<T>(url: string, body: unknown = {}, options: RequestOptions = {}): Promise<ApiResult<T>> {
    return request<T>('PUT', url, body, options)
  },

  delete<T>(url: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    return request<T>('DELETE', url, undefined, options)
  },

  getAll<T>(url: string, options: RequestOptions = {}): Promise<ApiResult<T>[]> {
    return requestAll<T>('GET', url, undefined, options)
  },

  async getAllWithProgress<T>(url: string, onResult: ProgressHandler<T>, options: RequestOptions = {}): Promise<void> {
    await Promise.all(getApiBases().map(async (baseUrl) => {
      const result = await request<T>('GET', url, undefined, { ...options, baseUrl })
      onResult(result)
    }))
  },

  postAll<T>(url: string, body: unknown = {}, options: RequestOptions = {}): Promise<ApiResult<T>[]> {
    return requestAll<T>('POST', url, body, options)
  },

  getByIndex<T>(url: string, index = 0, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const bases = getApiBases()
    return request<T>('GET', url, undefined, { ...options, baseUrl: bases[index] ?? bases[0] })
  },

  postByIndex<T>(url: string, body: unknown = {}, index = 0, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const bases = getApiBases()
    return request<T>('POST', url, body, { ...options, baseUrl: bases[index] ?? bases[0] })
  },
}

export { isAdminLoggedIn }
