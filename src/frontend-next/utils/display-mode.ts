import type { DashboardView, DisplayMode } from '../types/dashboard'

export const DEFAULT_DISPLAY_MODE: DisplayMode = 'bar'

export const ADMIN_DISPLAY_MODES: readonly DisplayMode[] = ['bar', 'ring', 'table']
export const DASHBOARD_VIEWS: readonly DashboardView[] = [...ADMIN_DISPLAY_MODES, 'map']

function isDisplayMode(value: string): value is DisplayMode {
  return ADMIN_DISPLAY_MODES.includes(value as DisplayMode)
}

function isDashboardView(value: string): value is DashboardView {
  return DASHBOARD_VIEWS.includes(value as DashboardView)
}

export function normalizeDisplayMode(value: unknown, fallback: DisplayMode = DEFAULT_DISPLAY_MODE): DisplayMode {
  const mode = String(value ?? '').trim().toLowerCase()
  if (mode === 'list') return 'table'
  return isDisplayMode(mode) ? mode : fallback
}

export function normalizeDashboardView(value: unknown, fallback: DisplayMode = DEFAULT_DISPLAY_MODE): DashboardView {
  const view = String(value ?? '').trim().toLowerCase()
  if (view === 'card') return fallback
  if (view === 'list') return 'table'
  return isDashboardView(view) ? view : fallback
}

export function resolveDisplayMode(source: unknown, fallback: DisplayMode = DEFAULT_DISPLAY_MODE): DisplayMode {
  if (typeof source !== 'object' || source === null || !('display_mode' in source)) return fallback
  return normalizeDisplayMode(source.display_mode, fallback)
}
