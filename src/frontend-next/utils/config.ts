declare global {
  interface Window {
    __APP_API_BASES__?: string[]
    __APP_WS_BASE__?: string
  }
}

let apiBases: string[] = []
let websocketBase = ''
let siteTitle = ''

const stripTrailingSlash = (value: unknown): string => String(value ?? '').replace(/\/+$/, '')

function computeWebsocketBase(origin: string): string {
  try {
    const url = new URL(origin)
    return `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
  } catch {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  }
}

export function setApiBases(values: readonly string[]): string[] {
  apiBases = [...new Set(values.map(stripTrailingSlash).filter(Boolean))]
  if (apiBases.length === 0) apiBases = [stripTrailingSlash(window.location.origin)]

  websocketBase = computeWebsocketBase(apiBases[0]!)
  window.__APP_API_BASES__ = [...apiBases]
  window.__APP_WS_BASE__ = websocketBase
  return [...apiBases]
}

export function initConfig(): string[] {
  setApiBases([window.location.origin])

  const configuredBases = document.querySelector<HTMLMetaElement>('meta[name="apiBase"]')?.content
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (configuredBases?.length) setApiBases(configuredBases)
  siteTitle = document.title
  return getApiBases()
}

export function getApiBases(): string[] {
  if (apiBases.length) return [...apiBases]
  if (window.__APP_API_BASES__?.length) return [...window.__APP_API_BASES__]
  return [stripTrailingSlash(window.location.origin)]
}

export function getWebsocketBase(apiIndex = 0): string {
  const base = getApiBases()[apiIndex]
  if (base) return computeWebsocketBase(base)
  return websocketBase || window.__APP_WS_BASE__ || computeWebsocketBase(getApiBases()[0]!)
}

// Compatibility name used throughout the legacy frontend.
export const getWsBase = (): string => getWebsocketBase(0)

export const hasMultipleApiBases = (): boolean => getApiBases().length > 1
export const getTitle = (): string => siteTitle

export function getPublicAssetUrl(assetPath: unknown): string {
  const cleanPath = String(assetPath ?? '').replace(/^\/+/, '')
  return cleanPath ? `./${cleanPath}` : './'
}

export {}
