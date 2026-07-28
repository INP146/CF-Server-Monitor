import type { ManagedServer, TargetOS } from '../data/admin'

export const targetOSOptions: Array<{ label: string; value: TargetOS }> = [
  { label: 'Linux (Ubuntu / Debian / CentOS)', value: 'linux' },
  { label: 'Alpine Linux', value: 'alpine' },
  { label: 'OpenWrt / LEDE / ImmortalWrt', value: 'openwrt' },
  { label: 'macOS (Intel / Apple Silicon)', value: 'mac' },
  { label: 'Synology DSM', value: 'synology' },
  { label: 'Windows', value: 'windows' },
]

const shellByOS: Record<TargetOS, string> = {
  linux: 'install.sh',
  alpine: 'install-alpine.sh',
  openwrt: 'install-openwrt.sh',
  mac: 'install-macos.sh',
  synology: 'install-synology.sh',
  windows: 'install.ps1',
}

export function buildInstallCommand(server: ManagedServer, targetOS: TargetOS): string {
  const args = [
    `--id ${server.id}`,
    `--collect ${server.collectInterval}`,
    `--report ${server.reportInterval}`,
    `--reset-day ${server.resetDay}`,
    server.autoUpdate ? '--auto-update' : '',
  ].filter(Boolean).join(' ')
  if (targetOS === 'windows') {
    return `irm https://monitor.example.com/${shellByOS[targetOS]} | iex; Install-EdgeProbe ${args}`
  }
  return `curl -fsSL https://monitor.example.com/${shellByOS[targetOS]} | sh -s -- ${args}`
}

export function buildUninstallCommand(server: ManagedServer, targetOS: TargetOS): string {
  if (targetOS === 'windows') return `Uninstall-EdgeProbe -ServerId ${server.id}`
  if (targetOS === 'openwrt') return `/etc/init.d/edgeprobe stop && opkg remove edgeprobe # ${server.id}`
  return `sudo edgeprobe-agent uninstall --id ${server.id}`
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
