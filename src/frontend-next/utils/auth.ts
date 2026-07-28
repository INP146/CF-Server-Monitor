import { getApiBases } from './config'
import { STORAGE } from './constants'

export const AUTH_EXPIRED_EVENT = 'edgeprobe:auth-expired'
export const TURNSTILE_EXPIRED_EVENT = 'edgeprobe:turnstile-expired'

const tokenKey = (baseUrl: string): string => `${STORAGE.JWT_TOKEN}:${encodeURIComponent(baseUrl)}`
const turnstileKey = (baseUrl: string): string => `${STORAGE.TURNSTILE_VERIFIED}:${encodeURIComponent(baseUrl)}`

export function normalizeApiIndex(value: unknown): number {
  const bases = getApiBases()
  const index = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(index) && index >= 0 && index < bases.length ? index : 0
}

export function getAuthTokenForBase(baseUrl: string): string {
  const scopedKey = tokenKey(baseUrl)
  const scoped = localStorage.getItem(scopedKey)
  if (scoped) return scoped

  const bases = getApiBases()
  if (baseUrl !== bases[0]) return ''

  const legacy = localStorage.getItem(STORAGE.JWT_TOKEN) || ''
  if (legacy) {
    localStorage.setItem(scopedKey, legacy)
    localStorage.removeItem(STORAGE.JWT_TOKEN)
  }
  return legacy
}

export function getAuthToken(apiIndex = 0): string {
  const bases = getApiBases()
  return getAuthTokenForBase(bases[normalizeApiIndex(apiIndex)] ?? bases[0]!)
}

export function setAuthToken(token: string, apiIndex = 0): void {
  const bases = getApiBases()
  const baseUrl = bases[normalizeApiIndex(apiIndex)] ?? bases[0]!
  if (token) localStorage.setItem(tokenKey(baseUrl), token)
  else localStorage.removeItem(tokenKey(baseUrl))
  localStorage.removeItem(STORAGE.JWT_TOKEN)
}

export function clearAuthTokenForBase(baseUrl: string): void {
  localStorage.removeItem(tokenKey(baseUrl))
  if (baseUrl === getApiBases()[0]) localStorage.removeItem(STORAGE.JWT_TOKEN)
}

export function clearAuthToken(apiIndex = 0): void {
  const bases = getApiBases()
  clearAuthTokenForBase(bases[normalizeApiIndex(apiIndex)] ?? bases[0]!)
}

export const isAdminLoggedIn = (apiIndex = 0): boolean => Boolean(getAuthToken(apiIndex))

export function getTurnstileVerificationForBase(baseUrl: string): string {
  const scopedKey = turnstileKey(baseUrl)
  const scoped = localStorage.getItem(scopedKey)
  if (scoped) return scoped
  if (baseUrl !== getApiBases()[0]) return ''

  const legacy = localStorage.getItem(STORAGE.TURNSTILE_VERIFIED) || ''
  if (legacy) {
    localStorage.setItem(scopedKey, legacy)
    localStorage.removeItem(STORAGE.TURNSTILE_VERIFIED)
  }
  return legacy
}

export function getTurnstileVerification(apiIndex = 0): string {
  const bases = getApiBases()
  return getTurnstileVerificationForBase(bases[normalizeApiIndex(apiIndex)] ?? bases[0]!)
}

export function setTurnstileVerificationForBase(baseUrl: string, value: string): void {
  if (value) localStorage.setItem(turnstileKey(baseUrl), value)
  else localStorage.removeItem(turnstileKey(baseUrl))
  localStorage.removeItem(STORAGE.TURNSTILE_VERIFIED)
}

export function clearTurnstileVerificationForBase(baseUrl: string): void {
  localStorage.removeItem(turnstileKey(baseUrl))
  if (baseUrl === getApiBases()[0]) localStorage.removeItem(STORAGE.TURNSTILE_VERIFIED)
}
