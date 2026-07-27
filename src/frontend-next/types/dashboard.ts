export type NumericValue = number | string | null | undefined

export type DashboardView = 'bar' | 'ring' | 'table' | 'map'
export type DisplayMode = Exclude<DashboardView, 'map'>

export interface DashboardServer {
  id: string
  name?: string
  source?: string
  server_group?: string
  region?: string
  price?: NumericValue
  currency?: string
  billing_cycle?: string
  traffic_calc_type?: string
  traffic_limit?: NumericValue
  net_rx_monthly?: NumericValue
  net_tx_monthly?: NumericValue
  cpu?: NumericValue
  ram_total?: NumericValue
  ram_used?: NumericValue
  disk_total?: NumericValue
  disk_used?: NumericValue
  net_in_speed?: NumericValue
  net_out_speed?: NumericValue
  net_rx?: NumericValue
  net_tx?: NumericValue
  report_timestamp?: NumericValue
  sample_timestamp?: NumericValue
  display_timestamp?: NumericValue
  current_timestamp?: NumericValue
  last_updated?: NumericValue
  timestamp?: NumericValue
  sample_lag_seconds?: number
  [key: string]: unknown
}

export interface DashboardStats {
  total: number
  online: number
  offline: number
  globalNetRx: number
  globalNetTx: number
  globalSpeedIn: number
  globalSpeedOut: number
}

export interface DashboardConfig {
  show_price: boolean
  show_expire: boolean
  show_tf: boolean
  show_time: boolean
  display_mode: DisplayMode
  site_title: string
}

export interface LiveSample {
  ts?: NumericValue
  timestamp?: NumericValue
  data?: Record<string, unknown>
  payload?: Record<string, unknown>
  metrics?: Record<string, unknown>
}

export interface LiveUpdate {
  serverId: string
  samples: LiveSample[]
  reportTs?: NumericValue
  report_timestamp?: NumericValue
  reportAgeMs?: number
  source?: string
}

export interface BatchUpdateMessage {
  type: 'batchUpdate'
  ts?: NumericValue
  updates: LiveUpdate[]
}

export interface ServersResponse {
  servers?: DashboardServer[]
  latestMetricsMap?: Record<string, Omit<DashboardServer, 'id'>>
  latestReportUpdates?: LiveUpdate[]
  stats?: Partial<DashboardStats>
  regionStats?: Record<string, number>
  sysConfig?: Partial<DashboardConfig>
}

export interface MergedDashboardData {
  servers: DashboardServer[]
  latestReportUpdates: LiveUpdate[]
  stats: DashboardStats
  regionStats: Record<string, number>
  sysConfig: DashboardConfig
  corsErrorSites?: string[]
}

export interface SiteConfigResponse extends Partial<DashboardConfig> {
  version?: string
  last_workers_version?: string
  last_agent_version?: string
}

export interface HistoryRecord extends Record<string, unknown> {
  timestamp?: NumericValue
}

export interface LoginResponse extends Record<string, unknown> {
  token: string
}

export interface OperationResponse extends Record<string, unknown> {
  success: boolean
  error?: string
}

export interface LiveSocketStatus {
  connected: boolean
  reason: string
}

export interface LiveSocketController {
  readonly isConnected: boolean
  close: () => void
  reconnect: () => void
}
