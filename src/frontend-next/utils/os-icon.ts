export interface OSConfig {
  name: string
  image: string
  keywords: readonly string[]
}

const OS_ICON_BASE = 'os-icons/'
const osConfigs: readonly OSConfig[] = [
  { name: 'AlmaLinux', image: 'os-alma.svg', keywords: ['alma', 'almalinux'] },
  { name: 'Alpine Linux', image: 'os-alpine.webp', keywords: ['alpine', 'alpine linux'] },
  { name: 'CentOS', image: 'os-centos.svg', keywords: ['centos', 'cent os'] },
  { name: 'Debian', image: 'os-debian.svg', keywords: ['debian', 'debian gnu/linux', 'deb'] },
  { name: 'Ubuntu', image: 'os-ubuntu.svg', keywords: ['ubuntu', 'elementary'] },
  { name: 'macOS', image: 'os-macos.svg', keywords: ['macos', 'mac os', 'darwin', 'os x'] },
  { name: 'Windows', image: 'os-windows.svg', keywords: ['windows', 'win32', 'win64', 'win10', 'win11', 'win server', 'microsoft'] },
  { name: 'Arch Linux', image: 'os-arch.svg', keywords: ['arch', 'archlinux', 'arch linux'] },
  { name: 'Kali Linux', image: 'os-kail.svg', keywords: ['kail', 'kali', 'kali linux'] },
  { name: 'iStoreOS', image: 'os-istore.png', keywords: ['istore', 'istoreos', 'istore os'] },
  { name: 'OpenWrt', image: 'os-openwrt.svg', keywords: ['openwrt', 'open wrt', 'open-wrt', 'qwrt', 'kwrt'] },
  { name: 'ImmortalWrt', image: 'os-openwrt.svg', keywords: ['immortalwrt', 'immortal', 'emmortal'] },
  { name: 'NixOS', image: 'os-nix.svg', keywords: ['nixos', 'nix os', 'nix'] },
  { name: 'Rocky Linux', image: 'os-rocky.svg', keywords: ['rocky', 'rocky linux'] },
  { name: 'Fedora', image: 'os-fedora.svg', keywords: ['fedora'] },
  { name: 'openSUSE', image: 'os-openSUSE.svg', keywords: ['opensuse', 'open suse', 'suse'] },
  { name: 'Gentoo', image: 'os-gentoo.svg', keywords: ['gentoo'] },
  { name: 'Red Hat', image: 'os-redhat.svg', keywords: ['redhat', 'rhel', 'red hat'] },
  { name: 'Linux Mint', image: 'os-mint.svg', keywords: ['mint', 'linux mint'] },
  { name: 'Manjaro', image: 'os-manjaro-.svg', keywords: ['manjaro'] },
  { name: 'Armbian', image: 'os-armbian.png', keywords: ['armbox', 'armbian'] },
  { name: 'Synology DSM', image: 'os-synology.ico', keywords: ['synology', 'dsm', 'synology dsm'] },
  { name: 'Proxmox VE', image: 'os-proxmox.ico', keywords: ['proxmox', 'proxmox ve', 'pve'] },
  { name: 'Alibaba Cloud Linux', image: 'os-alibaba.svg', keywords: ['alibaba', 'aliyun', 'alinux', 'anolis', 'openanolis', '阿里', '龙蜥'] },
  { name: 'OpenCloudOS', image: 'os-opencloud.svg', keywords: ['opencloud', 'opencloudos', 'opencloud os'] },
]

const defaultOSConfig: OSConfig = { name: 'Unknown', image: 'os-unknown.svg', keywords: ['unknown'] }

export function findOSConfig(osString: unknown): OSConfig {
  const input = String(osString ?? '').toLowerCase().trim()
  if (!input) return defaultOSConfig
  return osConfigs.find((config) => config.keywords.some((keyword) => input.includes(keyword))) ?? defaultOSConfig
}

export const getOSImage = (osString: unknown): string => `${OS_ICON_BASE}${findOSConfig(osString).image}`

export function getAllOSImages(): Record<string, string> {
  return Object.fromEntries([
    ...osConfigs.map((config) => [config.keywords[0]!, `${OS_ICON_BASE}${config.image}`]),
    ['unknown', `${OS_ICON_BASE}${defaultOSConfig.image}`],
  ])
}

export function getOSName(osString: unknown): string {
  const config = findOSConfig(osString)
  if (config !== defaultOSConfig) return config.name
  return String(osString ?? '').trim().split(/[\s/]/)[0] || defaultOSConfig.name
}

export const isSupportedOS = (osString: unknown): boolean => findOSConfig(osString) !== defaultOSConfig
