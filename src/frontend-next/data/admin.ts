import { dashboardServers, type MockServer } from './dashboard'

export type TargetOS = 'linux' | 'alpine' | 'openwrt' | 'mac' | 'synology' | 'windows'
export type TrafficCalculation = 'total' | 'ul' | 'dl' | 'max'

export interface ManagedServer extends MockServer {
  group: string
  enabled: boolean
  agentVersion: string
  note: string
  price: number
  currency: string
  billingCycle: string
  expireDate: string
  autoRenewal: boolean
  trafficLimit: number
  trafficCalcType: TrafficCalculation
  resetDay: number
  collectInterval: number
  reportInterval: number
  customCt: string
  customCu: string
  customCm: string
  customBd: string
  rxCorrection: number
  txCorrection: number
  autoUpdate: boolean
  isHidden: boolean
  offlineNotifyDisabled: boolean
}

export interface GlobalSettings {
  siteTitle: string
  defaultView: 'bar' | 'ring' | 'table'
  language: 'zh' | 'en'
  showPrice: boolean
  showExpire: boolean
  showTraffic: boolean
  showUpdateTime: boolean
  showLongHistory: boolean
  backgroundImage: string
  collectInterval: number
  reportInterval: number
  autoUpdate: boolean
  trafficResetDay: number
  customCt: string
  customCu: string
  customCm: string
  customBd: string
  telegramBotToken: string
  telegramChatId: string
  offlineNotifyMinutes: number
  turnstileSiteKey: string
  turnstileSecret: string
  jwtSecret: string
  cloudflareApiToken: string
  cspApi: string
  cspWs: string
  adminPassword: string
  confirmPassword: string
}

const regions = ['us', 'us', 'jp', 'jp', 'de', 'de', 'sg', 'sg']
const prices = [12, 8, 15, 6, 10, 5, 9, 4]

export const createManagedServers = (): ManagedServer[] => dashboardServers.map((server, index) => ({
  ...server,
  region: regions[index] ?? server.region,
  group: server.tags[0] || 'Default',
  enabled: index !== 5,
  agentVersion: index === 5 ? 'v1.2.3' : 'v1.2.4',
  note: index % 3 === 0 ? '核心业务节点' : '',
  price: prices[index] ?? 8,
  currency: '$',
  billingCycle: 'month',
  expireDate: `2027-${String(index + 1).padStart(2, '0')}-15`,
  autoRenewal: index % 2 === 0,
  trafficLimit: index % 2 === 0 ? 2048 : 1024,
  trafficCalcType: 'total',
  resetDay: 1,
  collectInterval: 3,
  reportInterval: 60,
  customCt: '',
  customCu: '',
  customCm: '',
  customBd: '',
  rxCorrection: 0,
  txCorrection: 0,
  autoUpdate: index !== 5,
  isHidden: false,
  offlineNotifyDisabled: false,
}))

export const createDefaultSettings = (): GlobalSettings => ({
  siteTitle: 'EdgeProbe',
  defaultView: 'bar',
  language: 'zh',
  showPrice: true,
  showExpire: true,
  showTraffic: true,
  showUpdateTime: true,
  showLongHistory: true,
  backgroundImage: '',
  collectInterval: 3,
  reportInterval: 60,
  autoUpdate: false,
  trafficResetDay: 1,
  customCt: 'gd-ct-dualstack.ip.zstaticcdn.com',
  customCu: 'gd-cu-dualstack.ip.zstaticcdn.com',
  customCm: 'gd-cm-dualstack.ip.zstaticcdn.com',
  customBd: 'ip.zstaticcdn.com',
  telegramBotToken: '',
  telegramChatId: '',
  offlineNotifyMinutes: 5,
  turnstileSiteKey: '',
  turnstileSecret: '',
  jwtSecret: 'mock-jwt-secret',
  cloudflareApiToken: '',
  cspApi: '',
  cspWs: '',
  adminPassword: '',
  confirmPassword: '',
})

export const apiEndpoints = [
  { label: '主站', value: 'https://monitor.example.com' },
  { label: '备用站', value: 'https://monitor-backup.example.com' },
]

