export type ServerStatus = 'online' | 'offline'

export interface MockServer {
  id: string
  name: string
  location: string
  region: string
  os: string
  arch: string
  ip: string
  status: ServerStatus
  cpu: number
  memory: number
  disk: number
  download: string
  upload: string
  latency: number | null
  uptime: string
  load: string
  tags: string[]
  group?: string
  priceText?: string
  expireDate?: string
  trafficUsed?: string
  trafficLimitText?: string
  trafficPercent?: number
  dataTime?: string
  apiIndex?: number
}

export const dashboardServers: MockServer[] = [
  {
    id: 'lax-core-01',
    name: 'LAX Core 01',
    location: 'Los Angeles, US',
    region: 'us',
    os: 'Ubuntu 24.04',
    arch: 'x86_64',
    ip: '172.16.4.21',
    status: 'online',
    cpu: 23,
    memory: 48,
    disk: 36,
    download: '684 KB/s',
    upload: '214 KB/s',
    latency: 42,
    uptime: '128 天',
    load: '0.42 / 0.38 / 0.31',
    tags: ['Core', 'IPv4/6'],
  },
  {
    id: 'sjc-edge-02',
    name: 'SJC Edge 02',
    location: 'San Jose, US',
    region: 'us',
    os: 'Debian 12',
    arch: 'x86_64',
    ip: '172.16.8.14',
    status: 'online',
    cpu: 67,
    memory: 72,
    disk: 51,
    download: '1.12 MB/s',
    upload: '384 KB/s',
    latency: 56,
    uptime: '84 天',
    load: '1.26 / 0.98 / 0.82',
    tags: ['Edge', 'IPv4/6'],
  },
  {
    id: 'nrt-core-01',
    name: 'NRT Core 01',
    location: 'Tokyo, JP',
    region: 'jp',
    os: 'Rocky Linux 9',
    arch: 'aarch64',
    ip: '10.24.12.8',
    status: 'online',
    cpu: 31,
    memory: 54,
    disk: 44,
    download: '746 KB/s',
    upload: '298 KB/s',
    latency: 68,
    uptime: '62 天',
    load: '0.64 / 0.51 / 0.46',
    tags: ['Core', 'IPv6'],
  },
  {
    id: 'nrt-edge-03',
    name: 'NRT Edge 03',
    location: 'Tokyo, JP',
    region: 'jp',
    os: 'Alpine Linux',
    arch: 'x86_64',
    ip: '10.24.15.33',
    status: 'online',
    cpu: 14,
    memory: 29,
    disk: 18,
    download: '326 KB/s',
    upload: '96 KB/s',
    latency: 71,
    uptime: '41 天',
    load: '0.18 / 0.22 / 0.19',
    tags: ['Edge', 'IPv4'],
  },
  {
    id: 'fra-core-01',
    name: 'FRA Core 01',
    location: 'Frankfurt, DE',
    region: 'de',
    os: 'Ubuntu 22.04',
    arch: 'x86_64',
    ip: '10.31.2.17',
    status: 'online',
    cpu: 45,
    memory: 61,
    disk: 58,
    download: '512 KB/s',
    upload: '173 KB/s',
    latency: 152,
    uptime: '216 天',
    load: '0.88 / 0.74 / 0.63',
    tags: ['Core', 'IPv4/6'],
  },
  {
    id: 'fra-edge-04',
    name: 'FRA Edge 04',
    location: 'Frankfurt, DE',
    region: 'de',
    os: 'Debian 12',
    arch: 'x86_64',
    ip: '10.31.5.49',
    status: 'offline',
    cpu: 0,
    memory: 0,
    disk: 63,
    download: '0 B/s',
    upload: '0 B/s',
    latency: null,
    uptime: '-',
    load: '- / - / -',
    tags: ['Edge', 'IPv4'],
  },
  {
    id: 'sin-core-01',
    name: 'SIN Core 01',
    location: 'Singapore, SG',
    region: 'sg',
    os: 'AlmaLinux 9',
    arch: 'aarch64',
    ip: '10.42.1.12',
    status: 'online',
    cpu: 38,
    memory: 57,
    disk: 39,
    download: '318 KB/s',
    upload: '82 KB/s',
    latency: 88,
    uptime: '93 天',
    load: '0.58 / 0.49 / 0.44',
    tags: ['Core', 'IPv4/6'],
  },
  {
    id: 'sin-edge-02',
    name: 'SIN Edge 02',
    location: 'Singapore, SG',
    region: 'sg',
    os: 'OpenWrt 23.05',
    arch: 'aarch64',
    ip: '10.42.3.27',
    status: 'online',
    cpu: 19,
    memory: 34,
    disk: 21,
    download: '184 KB/s',
    upload: '44 KB/s',
    latency: 93,
    uptime: '37 天',
    load: '0.24 / 0.21 / 0.18',
    tags: ['Edge', 'IPv6'],
  },
]
