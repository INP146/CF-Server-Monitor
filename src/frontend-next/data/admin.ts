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
  rxCorrection: number | null
  txCorrection: number | null
  autoUpdate: boolean
  isHidden: boolean
  offlineNotifyDisabled: boolean
}

export interface GlobalSettings {
  siteTitle: string
  defaultView: 'bar' | 'ring' | 'table'
  showPrice: boolean
  showExpire: boolean
  showTraffic: boolean
  showUpdateTime: boolean
  showLongHistory: boolean
  backgroundImage: string
  customHead: string
  customScript: string
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
  turnstileEnabled: boolean
  turnstileLoginEnabled: boolean
  jwtSecret: string
  adminUsername: string
  isPublic: boolean
  cloudflareAccountId: string
  cloudflareApiToken: string
  cspStatic: string
  cspApi: string
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
  collectInterval: 0,
  reportInterval: 60,
  customCt: '',
  customCu: '',
  customCm: '',
  customBd: '',
  rxCorrection: null,
  txCorrection: null,
  autoUpdate: index !== 5,
  isHidden: false,
  offlineNotifyDisabled: false,
}))

export const createDefaultSettings = (): GlobalSettings => ({
  siteTitle: 'EdgeProbe',
  defaultView: 'bar',
  showPrice: true,
  showExpire: true,
  showTraffic: true,
  showUpdateTime: true,
  showLongHistory: true,
  backgroundImage: '',
  customHead: '',
  customScript: '',
  collectInterval: 0,
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
  turnstileEnabled: false,
  turnstileLoginEnabled: false,
  jwtSecret: '',
  adminUsername: 'admin',
  isPublic: true,
  cloudflareAccountId: '',
  cloudflareApiToken: '',
  cspStatic: '',
  cspApi: '',
  adminPassword: '',
  confirmPassword: '',
})
