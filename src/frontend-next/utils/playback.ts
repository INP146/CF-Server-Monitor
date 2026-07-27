function toFiniteNumber(value: unknown, fallback: number | null = null): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function resolvePlaybackCursor(
  firstSampleTimestamp: unknown,
  currentDisplayTimestamp: unknown,
  options: { replayCachedReport?: boolean; reportAgeMs?: number } = {},
): number | null {
  const first = toFiniteNumber(firstSampleTimestamp)
  if (first === null) return null

  if (options.replayCachedReport) {
    return first + Math.max(0, toFiniteNumber(options.reportAgeMs, 0) ?? 0)
  }

  const current = toFiniteNumber(currentDisplayTimestamp)
  return current === null ? first : Math.max(first, current)
}

export function getPlaybackElapsedMs(nowTimestamp: unknown, previousTickTimestamp: unknown, fallbackMs = 1_000): number {
  const now = toFiniteNumber(nowTimestamp)
  const previous = toFiniteNumber(previousTickTimestamp)
  if (now === null || previous === null || now < previous) return Math.max(0, fallbackMs)
  return now - previous
}
