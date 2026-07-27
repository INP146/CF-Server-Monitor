import type { DashboardServer, NumericValue } from '../types/dashboard'
import { PING } from './constants'
import { formatBytes, toNumber } from './format'
import { normalizeTimestamp, formatDateTime } from './time'

export const DEFAULT_SERVER_CARD_CONFIG = {
  show_price: true,
  show_expire: true,
  show_tf: true,
  show_time: true,
  display_mode: 'bar',
} as const

export function clampPercent(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0
}

export function getTrafficUsageBytes(server: DashboardServer): number {
  const received = toNumber(server.net_rx_monthly as NumericValue)
  const transmitted = toNumber(server.net_tx_monthly as NumericValue)
  switch (server.traffic_calc_type) {
    case 'dl': return received
    case 'ul': return transmitted
    case 'max': return Math.max(received, transmitted)
    default: return received + transmitted
  }
}

export function calcTrafficUsagePercent(server: DashboardServer): number {
  const limitGb = toNumber(server.traffic_limit as NumericValue)
  return limitGb > 0 ? getTrafficUsageBytes(server) / (limitGb * 1024 ** 3) * 100 : 0
}

export function getUsageColor(value: unknown): string {
  const percent = clampPercent(value)
  if (percent >= 95) return 'var(--accent-red)'
  if (percent >= 80) return 'var(--accent-yellow)'
  if (percent >= 50) return 'var(--accent-blue)'
  return 'var(--accent-green)'
}

export function formatUptime(bootTime: unknown, now = Date.now(), language: 'zh' | 'en' = 'zh'): string {
  if (!bootTime) return 'N/A'
  const bootTimestamp = typeof bootTime === 'string' && !/^\d+$/.test(bootTime)
    ? new Date(bootTime).getTime()
    : normalizeTimestamp(bootTime as NumericValue)
  if (!bootTimestamp || !Number.isFinite(bootTimestamp) || bootTimestamp > now) return 'N/A'

  const totalSeconds = Math.floor((now - bootTimestamp) / 1_000)
  const values = [
    [Math.floor(totalSeconds / 86_400), language === 'zh' ? '天' : 'd'],
    [Math.floor(totalSeconds % 86_400 / 3_600), language === 'zh' ? '小时' : 'h'],
    [Math.floor(totalSeconds % 3_600 / 60), language === 'zh' ? '分' : 'm'],
    [totalSeconds % 60, language === 'zh' ? '秒' : 's'],
  ] as const
  const parts = values.filter(([value], index) => value > 0 || (index === 3 && !values.some(([item]) => item > 0)))
  return parts.slice(0, 3).map(([value, unit]) => `${value}${unit}`).join(' ')
}

export function formatMetricUsage(usedMb: unknown, totalMb: unknown): string {
  return `${formatBytes(toNumber(usedMb as NumericValue) * 1024 ** 2)} / ${formatBytes(toNumber(totalMb as NumericValue) * 1024 ** 2)}`
}

export function formatServerDataTime(server: DashboardServer, online: boolean): string {
  const reportTimestamp = normalizeTimestamp(server.report_timestamp ?? server.last_updated)
  if (!online) return formatDateTime(reportTimestamp)
  const displayTimestamp = normalizeTimestamp(
    server.display_timestamp ?? server.sample_timestamp ?? server.timestamp ?? reportTimestamp,
  )
  const sampleTimestamp = normalizeTimestamp(server.sample_timestamp ?? server.timestamp ?? displayTimestamp)
  const lagSeconds = displayTimestamp && sampleTimestamp
    ? Math.max(0, Math.floor((displayTimestamp - sampleTimestamp) / 1_000))
    : 0
  return `${formatDateTime(sampleTimestamp)}${lagSeconds > 0 ? ` (+${lagSeconds}s)` : ''}`
}

export const isPingDisabled = (ping: unknown): boolean => ping === false || ping === 'false'

export function isPingValid(ping: unknown): boolean {
  return !isPingDisabled(ping) && ping !== null && ping !== undefined && ping !== '' && toNumber(ping as NumericValue) > 0
}

export function getPingColor(ping: unknown): string {
  if (!isPingValid(ping)) return 'var(--accent-red)'
  const value = toNumber(ping as NumericValue)
  if (value < PING.GOOD_THRESHOLD) return 'var(--accent-green)'
  if (value < PING.WARNING_THRESHOLD) return 'var(--accent-yellow)'
  return 'var(--accent-red)'
}

export function getPingList(server: DashboardServer): { label: string; value: unknown }[] {
  return [
    { label: 'CT', value: server.ping_ct },
    { label: 'CU', value: server.ping_cu },
    { label: 'CM', value: server.ping_cm },
    { label: 'BD', value: server.ping_bd },
  ].filter((ping) => !isPingDisabled(ping.value))
}
