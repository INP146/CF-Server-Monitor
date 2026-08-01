import type { NumericValue } from '../types/dashboard'

export function normalizeTimestamp(value: NumericValue, fallback: number | null = null): number | null {
  const timestamp = Number(value)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp < 10_000_000_000 ? timestamp * 1_000 : timestamp
  }

  if (typeof value !== 'string' || !value.trim()) return fallback
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function formatDateTime(timestamp: NumericValue): string {
  const normalized = normalizeTimestamp(timestamp)
  if (!normalized) return '-'

  const date = new Date(normalized)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
