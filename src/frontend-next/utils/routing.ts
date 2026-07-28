const ROUTE_ORIGIN = 'https://edgeprobe.local'
const DEFAULT_ADMIN_ROUTE = '/admin/panel'

export function normalizeInternalRedirect(value: unknown, fallback = DEFAULT_ADMIN_ROUTE): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    const url = new URL(value, ROUTE_ORIGIN)
    if (url.origin !== ROUTE_ORIGIN || url.pathname === '/admin') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export function withApiIndex(route: string, apiIndex: number): string {
  const url = new URL(normalizeInternalRedirect(route), ROUTE_ORIGIN)
  url.searchParams.set('api', String(Math.max(0, apiIndex)))
  return `${url.pathname}${url.search}${url.hash}`
}

export function getPostLoginTarget(redirect: unknown, apiIndex: number): string {
  return withApiIndex(normalizeInternalRedirect(redirect), apiIndex)
}

