export const DEFAULT_SITE_TITLE = 'EdgeProbe'

export const TIME = {
  ONLINE_THRESHOLD_MS: 300_000,
  POLL_INTERVAL_MS: 60_000,
  RECONNECT_INITIAL_DELAY_MS: 1_000,
  RECONNECT_MAX_DELAY_MS: 30_000,
  MAX_RECONNECT_ATTEMPTS: 10,
  CHART_DATA_RETENTION_MS: 3_600_000,
} as const

export const CHART = {
  MAX_DATA_POINTS: 500,
  ANIMATION_DURATION: 300,
  MAX_TICKS: 8,
  MAX_TICKS_HOUR: 12,
} as const

export const PING = {
  GOOD_THRESHOLD: 100,
  WARNING_THRESHOLD: 200,
} as const

export const STORAGE = {
  THEME_PREFERENCE: 'theme_preference',
  LANGUAGE_PREFERENCE: 'language_preference',
  VIEW_PREFERENCE: 'monitor_preferred_view',
  JWT_TOKEN: 'jwt_token',
  TURNSTILE_TOKEN: 'turnstile_token',
  TURNSTILE_VERIFIED: 'turnstile_verified',
} as const

export const STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
} as const

export const COLORS = {
  ACCENT_GREEN: 'var(--accent-green)',
  ACCENT_RED: 'var(--accent-red)',
  ACCENT_CYAN: 'var(--accent-cyan)',
  ACCENT_PURPLE: 'var(--accent-purple)',
  ACCENT_YELLOW: 'var(--accent-yellow)',
  TEXT_MUTED: 'var(--text-muted)',
} as const
