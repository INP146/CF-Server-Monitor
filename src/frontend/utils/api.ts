import { ref } from 'vue'

import type {
  DashboardConfig,
  DashboardServer,
  DashboardStats,
  LiveUpdate,
  LoginResponse,
  MergedDashboardData,
  OperationResponse,
  HistoryRecord,
  ServersResponse,
  SiteConfigResponse,
} from '../types/dashboard'
import { getApiBases, getTitle, getWsBase, hasMultipleApiBases } from './config'
import { DEFAULT_SITE_TITLE, STORAGE } from './constants'
import { resolveDisplayMode } from './display-mode'
import { http, isAdminLoggedIn, type ApiResult } from './http'
import { clearAuthToken, setAuthToken } from './auth'
import { createLiveSocket } from './live-socket'

export { formatBytes, getFlagRegionCode, isServerOnline } from './format'
export { createLiveSocket, getApiBases, getWsBase, isAdminLoggedIn }

export const VERSION = ref('')
export const LAST_WORKERS_VERSION = ref('')
export const LAST_AGENT_VERSION = ref('')

const DEFAULT_STATS: DashboardStats = {
  total: 0,
  online: 0,
  offline: 0,
  globalNetRx: 0,
  globalNetTx: 0,
  globalSpeedIn: 0,
  globalSpeedOut: 0,
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  show_price: true,
  show_expire: true,
  show_tf: true,
  show_time: true,
  display_mode: 'bar',
  site_title: DEFAULT_SITE_TITLE,
}

export function createEmptyMergedData(): MergedDashboardData {
  return {
    servers: [],
    latestReportUpdates: [],
    stats: { ...DEFAULT_STATS },
    regionStats: {},
    sysConfig: { ...DEFAULT_DASHBOARD_CONFIG },
    siteConfigs: {},
    siteErrors: [],
  }
}

function serversFromResponse(data: ServersResponse): DashboardServer[] {
  if (Array.isArray(data.servers)) return data.servers
  return Object.entries(data.latestMetricsMap ?? {}).map(([id, metrics]) => ({ id, ...metrics }))
}

export function mergeSiteResult(
  target: MergedDashboardData,
  result: ApiResult<ServersResponse>,
  multiSite = hasMultipleApiBases(),
  localTitle = getTitle() || DEFAULT_SITE_TITLE,
  primaryBaseUrl = getApiBases()[0],
): void {
  if (result.error || !result.data) return

  for (const server of serversFromResponse(result.data)) {
    target.servers.push({ ...server, source: result.baseUrl })
  }

  for (const update of result.data.latestReportUpdates ?? []) {
    if (!update?.serverId || !Array.isArray(update.samples)) continue
    target.latestReportUpdates.push({ ...update, source: result.baseUrl })
  }

  for (const key of Object.keys(DEFAULT_STATS) as (keyof DashboardStats)[]) {
    target.stats[key] += Number(result.data.stats?.[key]) || 0
  }

  for (const [region, count] of Object.entries(result.data.regionStats ?? {})) {
    target.regionStats[region] = (target.regionStats[region] ?? 0) + (Number(count) || 0)
  }

  const config = result.data.sysConfig
  if (config) {
    const previous = target.siteConfigs[result.baseUrl] ?? DEFAULT_DASHBOARD_CONFIG
    const siteConfig: DashboardConfig = {
      show_price: config.show_price ?? previous.show_price,
      show_expire: config.show_expire ?? previous.show_expire,
      show_tf: config.show_tf ?? previous.show_tf,
      show_time: config.show_time ?? previous.show_time,
      display_mode: resolveDisplayMode(config, previous.display_mode),
      site_title: config.site_title || previous.site_title,
    }
    target.siteConfigs[result.baseUrl] = siteConfig
    if (!multiSite || result.baseUrl === primaryBaseUrl) {
      target.sysConfig = {
        ...siteConfig,
        site_title: multiSite ? localTitle : siteConfig.site_title,
      }
    }
  }
}

export async function fetchServers(): Promise<ServersResponse | null> {
  const result = await http.get<ServersResponse>('/api/servers')
  return result.error ? null : result.data ?? null
}

export async function fetchServersAll(): Promise<MergedDashboardData> {
  const multiSite = hasMultipleApiBases()
  const localTitle = getTitle() || DEFAULT_SITE_TITLE
  const merged = createEmptyMergedData()
  merged.sysConfig.site_title = multiSite ? localTitle : DEFAULT_SITE_TITLE

  const results = await http.getAll<ServersResponse>('/api/servers')
  let successfulSites = 0
  for (const result of results) {
    if (result.error || !result.data) {
      merged.siteErrors!.push({ baseUrl: result.baseUrl, message: result.message || result.error || '响应为空' })
      continue
    }
    successfulSites += 1
    mergeSiteResult(merged, result, multiSite, localTitle)
  }
  if (!successfulSites && results[0]) throw new ApiRequestError(results[0])
  return merged
}

export async function fetchServersAllWithProgress(
  onResult: (data: MergedDashboardData) => void,
): Promise<MergedDashboardData> {
  const multiSite = hasMultipleApiBases()
  const localTitle = getTitle() || DEFAULT_SITE_TITLE
  const merged = createEmptyMergedData()
  const corsErrorSites: string[] = []
  const siteErrors: Array<{ baseUrl: string; message: string }> = []
  let successfulSites = 0
  let firstError: ApiResult<ServersResponse> | null = null
  merged.sysConfig.site_title = multiSite ? localTitle : DEFAULT_SITE_TITLE

  await http.getAllWithProgress<ServersResponse>('/api/servers', (result) => {
    if (result.error || !result.data) {
      firstError ??= result
      siteErrors.push({ baseUrl: result.baseUrl, message: result.message || result.error || '响应为空' })
    } else {
      successfulSites += 1
    }
    mergeSiteResult(merged, result, multiSite, localTitle)
    if (result.corsError && !corsErrorSites.includes(result.baseUrl)) corsErrorSites.push(result.baseUrl)
    onResult({
      ...merged,
      servers: [...merged.servers],
      latestReportUpdates: [...merged.latestReportUpdates],
      stats: { ...merged.stats },
      regionStats: { ...merged.regionStats },
      sysConfig: { ...merged.sysConfig },
      siteConfigs: Object.fromEntries(Object.entries(merged.siteConfigs).map(([baseUrl, config]) => [baseUrl, { ...config }])),
      corsErrorSites: [...corsErrorSites],
      siteErrors: [...siteErrors],
    })
  })

  merged.corsErrorSites = corsErrorSites
  merged.siteErrors = siteErrors
  if (!successfulSites && firstError) throw new ApiRequestError(firstError)
  return merged
}

export async function fetchServerDetail(id: string, apiIndex = 0): Promise<DashboardServer> {
  const result = await http.getByIndex<DashboardServer>(`/api/server?id=${encodeURIComponent(id)}`, apiIndex)
  if (result.error || !result.data) throw new ApiRequestError(result)
  return result.data
}

export class ApiRequestError extends Error {
  readonly code?: string | number
  readonly status: number

  constructor(result: ApiResult<unknown>) {
    super(result.message || result.error || 'Request failed')
    this.name = 'ApiRequestError'
    this.code = result.code
    this.status = result.status
  }
}

export async function fetchAllHistory(id: string, hours: number, apiIndex = 0): Promise<HistoryRecord[]> {
  const query = new URLSearchParams({ id, hours: String(hours) })
  const result = await http.getByIndex<HistoryRecord[]>(`/api/history/all?${query}`, apiIndex, {
    autoRedirect: false,
    notifyTurnstileExpired: true,
  })
  if (result.error) throw new ApiRequestError(result)
  return Array.isArray(result.data) ? result.data : []
}

export function adminApi<T = Record<string, unknown>>(
  data: Record<string, unknown>,
  apiIndex = 0,
): Promise<ApiResult<T>> {
  return http.postByIndex<T>('/admin/api', data, apiIndex)
}

export async function login(
  username: string,
  password: string,
  turnstileToken = '',
  apiIndex = 0,
): Promise<ApiResult<LoginResponse>> {
  if (turnstileToken) localStorage.setItem(STORAGE.TURNSTILE_TOKEN, turnstileToken)

  const result = await http.postByIndex<LoginResponse>('/admin/api', {
    action: 'login',
    username,
    password,
  }, apiIndex, { autoRedirect: false })

  if (!result.error && result.data?.token) {
    setAuthToken(result.data.token, apiIndex)
  }
  return result
}

export function logout(apiIndex = 0): void {
  clearAuthToken(apiIndex)
}

export async function fetchConfig(apiIndex = 0): Promise<SiteConfigResponse | null> {
  const result = await http.getByIndex<SiteConfigResponse>('/api/config', apiIndex, {
    includeAuth: true,
    includeTurnstile: false,
  })
  if (result.error || !result.data) return null

  VERSION.value = result.data.version ?? ''
  LAST_WORKERS_VERSION.value = result.data.last_workers_version ?? ''
  LAST_AGENT_VERSION.value = result.data.last_agent_version ?? ''
  return result.data
}

async function runDatabaseOperation(path: string, apiIndex: number): Promise<OperationResponse> {
  const result = await http.postByIndex<OperationResponse>(path, {}, apiIndex, { autoRedirect: false })
  if (result.error) {
    return { success: false, error: result.message || result.error }
  }
  return result.data ?? { success: true }
}

export function upgradeDatabase(apiIndex = 0): Promise<OperationResponse> {
  return runDatabaseOperation('/updateDatabase', apiIndex)
}

export function clearHistory(apiIndex = 0): Promise<OperationResponse> {
  return runDatabaseOperation('/clearHistory', apiIndex)
}

export function latestReportUpdates(data: MergedDashboardData): LiveUpdate[] {
  return Array.isArray(data.latestReportUpdates) ? data.latestReportUpdates : []
}
