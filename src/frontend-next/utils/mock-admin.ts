import type { ManagedServer, TargetOS } from '../data/admin'

export const targetOSOptions: Array<{ label: string; value: TargetOS }> = [
  { label: 'Linux (Ubuntu / Debian / CentOS)', value: 'linux' },
  { label: 'Alpine Linux', value: 'alpine' },
  { label: 'OpenWrt / LEDE / ImmortalWrt', value: 'openwrt' },
  { label: 'macOS (Intel / Apple Silicon)', value: 'mac' },
  { label: 'Synology DSM', value: 'synology' },
  { label: 'Windows', value: 'windows' },
]

const scriptByOS: Record<TargetOS, string> = {
  linux: 'install.sh',
  alpine: 'install-alpine.sh',
  openwrt: 'install-openwrt.sh',
  mac: 'install-mac.sh',
  synology: 'install-synology.sh',
  windows: 'cf-server-monitor.ps1',
}

export const getInstallerScript = (targetOS: TargetOS): string => scriptByOS[targetOS]

const shellQuote = (value: unknown): string => `'${String(value ?? '').replace(/'/g, `'\\''`)}'`
const powershellQuote = (value: unknown): string => `'${String(value ?? '').replace(/'/g, "''")}'`
const hasCorrection = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function buildInstallCommand(
  server: ManagedServer,
  targetOS: TargetOS,
  apiBase = 'https://monitor.example.com',
  apiSecret = '',
): string {
  const base = apiBase.replace(/\/+$/, '')
  const autoUpdate = server.autoUpdate ? 1 : 0
  if (targetOS === 'windows') {
    const parameters = [
      'install',
      `-Id ${powershellQuote(server.id)}`,
      `-Secret ${powershellQuote(apiSecret)}`,
      `-Url ${powershellQuote(`${base}/update`)}`,
      `-CollectInterval ${server.collectInterval}`,
      `-ReportInterval ${server.reportInterval}`,
      `-ResetDay ${server.resetDay}`,
      `-AutoUpdate ${autoUpdate}`,
    ]
    if (server.customCt) parameters.push(`-CtNode ${powershellQuote(server.customCt)}`)
    if (server.customCu) parameters.push(`-CuNode ${powershellQuote(server.customCu)}`)
    if (server.customCm) parameters.push(`-CmNode ${powershellQuote(server.customCm)}`)
    if (server.customBd) parameters.push(`-BdNode ${powershellQuote(server.customBd)}`)
    if (hasCorrection(server.rxCorrection)) parameters.push(`-RxCorrection ${server.rxCorrection}`)
    if (hasCorrection(server.txCorrection)) parameters.push(`-TxCorrection ${server.txCorrection}`)
    return `irm ${powershellQuote(`${base}/${getInstallerScript(targetOS)}`)} -OutFile cf-server-monitor.ps1; powershell -ExecutionPolicy Bypass -File .\\cf-server-monitor.ps1 ${parameters.join(' ')}`
  }
  const shell = targetOS === 'alpine' || targetOS === 'openwrt' ? 'sh' : 'bash'
  const sudo = targetOS === 'mac' ? 'sudo ' : ''
  const parameters = [
    'install',
    `-id=${shellQuote(server.id)}`,
    `-secret=${shellQuote(apiSecret)}`,
    `-url=${shellQuote(`${base}/update`)}`,
    `-collect_interval=${server.collectInterval}`,
    `-interval=${server.reportInterval}`,
    `-reset_day=${server.resetDay}`,
    `-auto_update=${autoUpdate}`,
  ]
  if (server.customCt) parameters.push(`-ct=${shellQuote(server.customCt)}`)
  if (server.customCu) parameters.push(`-cu=${shellQuote(server.customCu)}`)
  if (server.customCm) parameters.push(`-cm=${shellQuote(server.customCm)}`)
  if (server.customBd) parameters.push(`-bd=${shellQuote(server.customBd)}`)
  if (hasCorrection(server.rxCorrection)) parameters.push(`-rx_correction=${server.rxCorrection}`)
  if (hasCorrection(server.txCorrection)) parameters.push(`-tx_correction=${server.txCorrection}`)
  return `curl -fsSL ${shellQuote(`${base}/${getInstallerScript(targetOS)}`)} | ${sudo}${shell} -s ${parameters.join(' ')}`
}

export function buildUninstallCommand(
  _server: ManagedServer,
  targetOS: TargetOS,
  apiBase = 'https://monitor.example.com',
): string {
  const base = apiBase.replace(/\/+$/, '')
  if (targetOS === 'windows') {
    return `irm ${powershellQuote(`${base}/${getInstallerScript(targetOS)}`)} -OutFile cf-server-monitor.ps1; powershell -ExecutionPolicy Bypass -File .\\cf-server-monitor.ps1 uninstall`
  }
  const shell = targetOS === 'alpine' || targetOS === 'openwrt' ? 'sh' : 'bash'
  const sudo = targetOS === 'mac' ? 'sudo ' : ''
  return `curl -fsSL ${shellQuote(`${base}/${getInstallerScript(targetOS)}`)} | ${sudo}${shell} -s uninstall`
}

export function serializeServers(servers: ManagedServer[]): string {
  return JSON.stringify(servers, null, 2)
}

export function parseServerBackup(value: string): ManagedServer[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed)) throw new Error('备份文件必须是服务器数组')
  return parsed.filter((item): item is ManagedServer => (
    typeof item === 'object' && item !== null && typeof (item as ManagedServer).id === 'string'
  ))
}

export function createMetricSeries(seed: number, base: number, amplitude: number, points = 32): number[] {
  return Array.from({ length: points }, (_, index) => {
    const wave = Math.sin((index + seed) * 0.55) * amplitude
    const ripple = Math.cos((index + seed * 2) * 0.23) * amplitude * 0.35
    return Math.max(0, Number((base + wave + ripple).toFixed(1)))
  })
}
