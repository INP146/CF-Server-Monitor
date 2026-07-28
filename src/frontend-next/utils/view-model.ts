import type { MockServer } from '../data/dashboard'
import type { DashboardServer, HistoryRecord, NumericValue } from '../types/dashboard'
import { formatBytes, isServerOnline, toNumber } from './format'
import { formatUptime } from './server-card'

const percent = (used: NumericValue, total: NumericValue): number => {
  const totalValue = toNumber(total)
  return totalValue > 0 ? Math.round(toNumber(used) / totalValue * 100) : 0
}

const stringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean)
}

const firstPositive = (...values: unknown[]): number | null => {
  for (const value of values) {
    const number = toNumber(value as NumericValue)
    if (number > 0) return Math.round(number)
  }
  return null
}

const normalizedLoad = (value: unknown): string => {
  const parts = String(value ?? '').trim().split(/[\s/]+/).filter(Boolean).slice(0, 3)
  return parts.length ? parts.join(' / ') : '- / - / -'
}

export function toDisplayServer(server: DashboardServer, now = Date.now(), apiIndex?: number): MockServer {
  const online = typeof server.is_online === 'boolean'
    ? server.is_online
    : isServerOnline(server, now)
  const region = String(server.region ?? server.region_override ?? 'xx').trim().toLowerCase() || 'xx'
  const ip = String(server.ip_v4 && server.ip_v4 !== '0'
    ? server.ip_v4
    : server.ip_v6 && server.ip_v6 !== '0'
      ? server.ip_v6
      : '-')

  return {
    id: server.id,
    name: String(server.name || server.id),
    location: String(server.location || region.toUpperCase()),
    region,
    os: String(server.os || 'Unknown'),
    arch: String(server.arch || '-'),
    ip,
    status: online ? 'online' : 'offline',
    cpu: Math.round(toNumber(server.cpu)),
    memory: percent(server.ram_used, server.ram_total),
    disk: percent(server.disk_used, server.disk_total),
    download: online ? `${formatBytes(server.net_in_speed)}/s` : '0 B/s',
    upload: online ? `${formatBytes(server.net_out_speed)}/s` : '0 B/s',
    latency: online ? firstPositive(server.ping_ct, server.ping_cu, server.ping_cm, server.ping_bd) : null,
    uptime: online ? formatUptime(server.boot_time, now) : '-',
    load: online ? normalizedLoad(server.load_avg) : '- / - / -',
    tags: stringList(server.tags),
    apiIndex,
  }
}

export const historyNumbers = (history: readonly HistoryRecord[], field: string): number[] => history
  .map((record) => Number.parseFloat(String(record[field] ?? '')))
  .filter(Number.isFinite)

export const historyPercents = (
  history: readonly HistoryRecord[],
  usedField: string,
  totalField: string,
): number[] => history.flatMap((record) => {
  const total = Number.parseFloat(String(record[totalField] ?? ''))
  const used = Number.parseFloat(String(record[usedField] ?? ''))
  return Number.isFinite(total) && total > 0 && Number.isFinite(used) ? [used / total * 100] : []
})

export function historyLoad(history: readonly HistoryRecord[], index: number): number[] {
  return history.flatMap((record) => {
    const parts = String(record.load_avg ?? '').trim().split(/[\s/]+/)
    const value = Number.parseFloat(parts[index] ?? '')
    return Number.isFinite(value) ? [value] : []
  })
}
