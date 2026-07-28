import type { DashboardServer, NumericValue } from '../types/dashboard'
import { TIME } from './constants'
import { normalizeTimestamp } from './time'

export function toNumber(value: NumericValue): number {
  const number = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(number) ? number : 0
}

export function formatBytes(value: NumericValue): string {
  const bytes = Math.max(0, toNumber(value))
  if (bytes === 0) return '0 B'

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1))
  const amount = Number.parseFloat((bytes / 1024 ** index).toFixed(1))
  return `${amount} ${sizes[index]}`
}

export function getFlagRegionCode(region: unknown): string {
  const code = String(region ?? '').toUpperCase()
  return code === 'TW' ? 'cn' : code.toLowerCase()
}

export function isServerOnline(server: DashboardServer, now = Date.now()): boolean {
  const lastUpdated = normalizeTimestamp(server.report_timestamp ?? server.last_updated)
  return lastUpdated !== null && now - lastUpdated < TIME.ONLINE_THRESHOLD_MS
}
