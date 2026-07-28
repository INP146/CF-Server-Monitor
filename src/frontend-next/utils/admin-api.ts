import type { GlobalSettings, ManagedServer } from '../data/admin'
import type { DashboardServer, NumericValue } from '../types/dashboard'
import { adminApi } from './api'
import { isServerOnline, toNumber } from './format'
import { formatUptime } from './server-card'

export interface AdminListResponse {
  success?: boolean
  servers?: DashboardServer[]
  stats?: {
    total?: number
    online?: number
    offline?: number
    avg_cpu?: number | string
    total_net_in?: number
    total_net_out?: number
  }
}

export interface AdminSettingsResponse {
  success?: boolean
  settings?: Record<string, unknown>
  api_secret?: string
}

export interface AdminOperationResponse extends Record<string, unknown> {
  success?: boolean
  message?: string
  id?: string
}

export interface AdminUsageResponse extends AdminOperationResponse {
  usage?: {
    today?: { rowsRead?: number; rowsWritten?: number; workersRequests?: number }
    last24Hours?: { rowsRead?: number; rowsWritten?: number; workersRequests?: number }
  }
}

const bool = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 'true'
const allowedCollectIntervals = new Set([0, 1, 2, 5, 10])
const allowedReportIntervals = new Set([30, 60, 120, 180])
const number = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = toNumber(value as NumericValue)
  return Number.isFinite(parsed) ? parsed : fallback
}

const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = toNumber(value as NumericValue)
  return Number.isFinite(parsed) ? parsed : null
}

export function toManagedServer(server: DashboardServer, now = Date.now()): ManagedServer {
  const online = typeof server.is_online === 'boolean' ? server.is_online : isServerOnline(server, now)
  const ramTotal = number(server.ram_total)
  const diskTotal = number(server.disk_total)
  const region = String(server.region ?? server.region_override ?? 'xx').toLowerCase()
  const isHidden = bool(server.is_hidden)

  return {
    id: server.id,
    name: String(server.name || server.id),
    location: String(server.location || region.toUpperCase()),
    region,
    os: String(server.os || 'Unknown'),
    arch: String(server.arch || '-'),
    ip: String(server.ip_v4 && server.ip_v4 !== '0' ? server.ip_v4 : server.ip_v6 || '-'),
    status: online ? 'online' : 'offline',
    cpu: Math.round(number(server.cpu)),
    memory: ramTotal > 0 ? Math.round(number(server.ram_used) / ramTotal * 100) : 0,
    disk: diskTotal > 0 ? Math.round(number(server.disk_used) / diskTotal * 100) : 0,
    download: String(server.net_in_speed ?? '0'),
    upload: String(server.net_out_speed ?? '0'),
    latency: online ? Math.round(number(server.ping_ct || server.ping_cu || server.ping_cm || server.ping_bd)) || null : null,
    uptime: online ? formatUptime(server.boot_time, now) : '-',
    load: String(server.load_avg || '- / - / -').replace(/\s+/g, ' / '),
    tags: String(server.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
    group: String(server.server_group || 'Default'),
    enabled: !isHidden,
    agentVersion: String(server.agent_version || '-'),
    note: String(server.note || ''),
    price: number(server.price),
    currency: String(server.currency || '¥'),
    billingCycle: String(server.billing_cycle || 'month'),
    expireDate: String(server.expire_date || ''),
    autoRenewal: bool(server.auto_renewal),
    trafficLimit: number(server.traffic_limit),
    trafficCalcType: ['ul', 'dl', 'max'].includes(String(server.traffic_calc_type))
      ? String(server.traffic_calc_type) as ManagedServer['trafficCalcType']
      : 'total',
    resetDay: number(server.reset_day, 1),
    collectInterval: allowedCollectIntervals.has(number(server.collect_interval)) ? number(server.collect_interval) : 0,
    reportInterval: allowedReportIntervals.has(number(server.report_interval, 60)) ? number(server.report_interval, 60) : 60,
    customCt: String(server.custom_ct || ''),
    customCu: String(server.custom_cu || ''),
    customCm: String(server.custom_cm || ''),
    customBd: String(server.custom_bd || ''),
    rxCorrection: nullableNumber(server.rx_correction),
    txCorrection: nullableNumber(server.tx_correction),
    autoUpdate: bool(server.auto_update),
    isHidden,
    offlineNotifyDisabled: bool(server.offline_notify_disabled),
  }
}

export function toAdminServerPayload(server: ManagedServer): Record<string, unknown> {
  return {
    id: server.id,
    name: server.name,
    server_group: server.group,
    region: server.region,
    tags: server.tags.join(','),
    note: server.note,
    price: server.price,
    currency: server.currency,
    billing_cycle: server.billingCycle,
    expire_date: server.expireDate,
    auto_renewal: server.autoRenewal,
    traffic_limit: server.trafficLimit,
    traffic_calc_type: server.trafficCalcType,
    reset_day: server.resetDay,
    collect_interval: server.collectInterval,
    report_interval: server.reportInterval,
    custom_ct: server.customCt,
    custom_cu: server.customCu,
    custom_cm: server.customCm,
    custom_bd: server.customBd,
    rx_correction: server.rxCorrection,
    tx_correction: server.txCorrection,
    auto_update: server.autoUpdate,
    is_hidden: server.isHidden,
    offline_notify_disabled: server.offlineNotifyDisabled,
  }
}

export function applyAdminSettings(target: GlobalSettings, source: Record<string, unknown>): void {
  target.siteTitle = String(source.site_title || '')
  target.defaultView = ['ring', 'table'].includes(String(source.display_mode))
    ? String(source.display_mode) as GlobalSettings['defaultView']
    : 'bar'
  target.showPrice = bool(source.show_price)
  target.showExpire = bool(source.show_expire)
  target.showTraffic = bool(source.show_tf)
  target.showUpdateTime = bool(source.show_time)
  target.showLongHistory = bool(source.show_long_history)
  target.backgroundImage = String(source.custom_bg || '')
  target.customHead = String(source.custom_head || '')
  target.customScript = String(source.custom_script || '')
  target.customCt = String(source.custom_ct || '')
  target.customCu = String(source.custom_cu || '')
  target.customCm = String(source.custom_cm || '')
  target.customBd = String(source.custom_bd || '')
  target.telegramBotToken = String(source.tg_bot_token || '')
  target.telegramChatId = String(source.tg_chat_id || '')
  target.offlineNotifyMinutes = number(source.tg_notify as NumericValue)
  target.turnstileEnabled = bool(source.turnstile_enabled)
  target.turnstileLoginEnabled = bool(source.turnstile_login_enabled)
  target.turnstileSiteKey = String(source.turnstile_site_key || '')
  target.turnstileSecret = String(source.turnstile_secret_key || '')
  target.cloudflareAccountId = String(source.cloudflare_account_id || '')
  target.cloudflareApiToken = String(source.cloudflare_token || '')
  target.cspStatic = String(source.csp_static || '')
  target.cspApi = String(source.csp_api || '')
  target.adminUsername = String(source.username || 'admin')
  target.isPublic = bool(source.is_public)
}

export function toAdminSettingsPayload(settings: GlobalSettings): Record<string, unknown> {
  return {
    site_title: settings.siteTitle,
    custom_bg: settings.backgroundImage,
    custom_head: settings.customHead,
    custom_script: settings.customScript,
    display_mode: settings.defaultView,
    is_public: String(settings.isPublic),
    show_price: String(settings.showPrice),
    show_expire: String(settings.showExpire),
    show_tf: String(settings.showTraffic),
    show_time: String(settings.showUpdateTime),
    show_long_history: String(settings.showLongHistory),
    custom_ct: settings.customCt,
    custom_cu: settings.customCu,
    custom_cm: settings.customCm,
    custom_bd: settings.customBd,
    tg_notify: String(settings.offlineNotifyMinutes),
    tg_bot_token: settings.telegramBotToken,
    tg_chat_id: settings.telegramChatId,
    turnstile_enabled: String(settings.turnstileEnabled),
    turnstile_login_enabled: String(settings.turnstileLoginEnabled),
    turnstile_site_key: settings.turnstileSiteKey,
    turnstile_secret_key: settings.turnstileSecret,
    cloudflare_account_id: settings.cloudflareAccountId,
    cloudflare_token: settings.cloudflareApiToken,
    csp_static: settings.cspStatic,
    csp_api: settings.cspApi,
    username: settings.adminUsername,
    ...(settings.jwtSecret ? { jwt_secret: settings.jwtSecret } : {}),
    ...(settings.adminPassword ? { password: settings.adminPassword } : {}),
  }
}

export async function runAdminAction<T = AdminOperationResponse>(
  action: string,
  payload: Record<string, unknown> = {},
  apiIndex = 0,
): Promise<T> {
  const result = await adminApi<T>({ action, ...payload }, apiIndex)
  if (result.error || !result.data) throw new Error(result.message || result.error || '请求失败')
  if (typeof result.data === 'object' && result.data !== null && 'success' in result.data && result.data.success === false) {
    const message = 'message' in result.data ? String(result.data.message || '') : ''
    const error = 'error' in result.data ? String(result.data.error || '') : ''
    throw new Error(message || error || '请求失败')
  }
  return result.data
}
