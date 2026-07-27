import type { ApiResult } from './http'
import { http } from './http'
import { STORAGE } from './constants'

export interface TurnstileConfig extends Record<string, unknown> {
  turnstile_enabled?: boolean | string
  turnstile_login_enabled?: boolean | string
  turnstile_site_key?: string
  verified?: boolean
}

export interface TurnstileSite {
  index: number
  data: TurnstileConfig
  siteKey: string
  verified: boolean
}

export interface TurnstileWidgetOptions {
  sitekey: string
  callback?: (token: string) => void
  errorCallback?: () => void
  expiredCallback?: () => void
}

export interface TurnstileApi {
  render: (container: string | HTMLElement, options: TurnstileWidgetOptions) => string
  remove: (widgetId: string) => void
  reset: (widgetIdOrContainer?: string | HTMLElement) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
let turnstileScriptPromise: Promise<void> | null = null

export const isTurnstileValueEnabled = (value: unknown): boolean => value === true || value === 'true'
export const normalizeTurnstileSiteKey = (value: unknown): string => String(value ?? '').trim()

export function setTurnstileToken(token: string): void {
  if (token) localStorage.setItem(STORAGE.TURNSTILE_TOKEN, token)
}

export const getTurnstileToken = (): string => localStorage.getItem(STORAGE.TURNSTILE_TOKEN) || ''
export const clearTurnstileToken = (): void => localStorage.removeItem(STORAGE.TURNSTILE_TOKEN)
export const hasSharedTurnstileVerified = (): boolean => Boolean(localStorage.getItem(STORAGE.TURNSTILE_VERIFIED))

export function getTurnstileEnabledSites(
  results: readonly ApiResult<TurnstileConfig>[],
  mode: 'global' | 'login' = 'global',
): TurnstileSite[] {
  return results.flatMap((result, index): TurnstileSite[] => {
    if (result.error || !result.data) return []
    const enabled = mode === 'login'
      ? isTurnstileValueEnabled(result.data.turnstile_enabled)
        || isTurnstileValueEnabled(result.data.turnstile_login_enabled)
      : isTurnstileValueEnabled(result.data.turnstile_enabled)
    return enabled ? [{
      index,
      data: result.data,
      siteKey: normalizeTurnstileSiteKey(result.data.turnstile_site_key),
      verified: result.data.verified === true,
    }] : []
  })
}

export function hasTurnstileSiteKeyMismatch(sites: readonly TurnstileSite[]): boolean {
  const keys = new Set(sites.map((site) => site.siteKey).filter(Boolean))
  return sites.some((site) => !site.siteKey) || keys.size > 1
}

export async function fetchAllTurnstileConfigs(): Promise<ApiResult<TurnstileConfig>[]> {
  let results = await http.getAll<TurnstileConfig>('/api/config', {
    includeAuth: true,
    includeTurnstile: true,
    autoRedirect: false,
  })
  if (results.some((result) => result.status === 403)) {
    results = await http.getAll<TurnstileConfig>('/api/config', {
      includeAuth: true,
      includeTurnstile: false,
      autoRedirect: false,
    })
  }
  return results
}

export function fetchTurnstileConfigByIndex(apiIndex = 0): Promise<ApiResult<TurnstileConfig>> {
  return http.getByIndex<TurnstileConfig>('/api/config', apiIndex, {
    includeAuth: true,
    includeTurnstile: false,
    includeTurnstileVerified: false,
    autoRedirect: false,
  })
}

export function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (turnstileScriptPromise) return turnstileScriptPromise

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = (error) => {
      turnstileScriptPromise = null
      reject(error)
    }
    document.head.appendChild(script)
  })
  return turnstileScriptPromise
}
