export type ChartTimeUnit = 'minute' | 'hour' | 'day'
export type ChartValueFormat = 'number' | 'bytes-per-second'

export interface ChartPoint {
  timestamp: number
  value: number | null
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function getChartTimeUnit(duration: number): ChartTimeUnit {
  if (duration <= 3 * HOUR) return 'minute'
  if (duration <= 3 * DAY) return 'hour'
  return 'day'
}

export function formatChartTimeTick(timestamp: number, duration: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (duration <= DAY) return time
  const datePart = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return duration <= 7 * DAY ? `${datePart} ${time}` : datePart
}

export function formatChartTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatChartValue(value: number, unit = '', format: ChartValueFormat = 'number'): string {
  if (format === 'bytes-per-second') {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
    let scaled = Math.max(0, value)
    let unitIndex = 0
    while (scaled >= 1024 && unitIndex < units.length - 1) {
      scaled /= 1024
      unitIndex += 1
    }
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
    return `${Number(scaled.toFixed(digits))} ${units[unitIndex]}`
  }

  const absolute = Math.abs(value)
  const digits = absolute >= 100 ? 0 : absolute >= 10 ? 1 : 2
  return `${Number(value.toFixed(digits))}${unit}`
}

export function insertChartGapBreaks(points: readonly ChartPoint[], duration: number): ChartPoint[] {
  if (points.length < 2) return [...points]
  const threshold = Math.max(5 * MINUTE, Math.ceil(duration / 160))
  const output: ChartPoint[] = []

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!
    output.push(point)
    const next = points[index + 1]
    if (!next) continue
    if (next.timestamp - point.timestamp > threshold * 1.1) {
      output.push({ timestamp: point.timestamp + (next.timestamp - point.timestamp) / 2, value: null })
    }
  }

  return output
}
