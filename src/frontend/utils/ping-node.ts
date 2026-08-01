const HOST_PATTERN = /^[a-zA-Z0-9._-]+$/
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/
const IPV4_LIKE_PATTERN = /^(?:\d+\.){3}\d+$/

export const PING_NODE_FIELDS = ['custom_ct', 'custom_cu', 'custom_cm', 'custom_bd'] as const

export interface PingNodeValidation {
  valid: boolean
  value?: string
}

function isValidIpv4(host: string): boolean {
  return IPV4_PATTERN.test(host) && host.split('.').every((part) => {
    const number = Number(part)
    return Number.isInteger(number) && number >= 0 && number <= 255
  })
}

function isValidHostname(host: string): boolean {
  if (!HOST_PATTERN.test(host) || host.length > 50 || IPV4_LIKE_PATTERN.test(host)) return false
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return false
  return host.split('.').every((label) =>
    Boolean(label)
    && label.length <= 63
    && /^[a-zA-Z0-9_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?$/.test(label),
  )
}

export function validatePingNode(value: unknown): PingNodeValidation {
  const raw = String(value ?? '').trim()
  if (!raw) return { valid: true, value: '' }
  if (raw.length > 60 || raw.includes('://') || /[\s/@?#\[\]]/.test(raw)) return { valid: false }

  const colonCount = raw.match(/:/g)?.length ?? 0
  if (colonCount > 1) return { valid: false }
  let [host = '', port = ''] = raw.split(':')
  if (colonCount === 1) {
    if (!/^\d{1,5}$/.test(port)) return { valid: false }
    const portNumber = Number(port)
    if (portNumber < 1 || portNumber > 65_535) return { valid: false }
    port = String(portNumber)
  }

  host = host.toLowerCase()
  if (!host || (!isValidIpv4(host) && !isValidHostname(host))) return { valid: false }
  return { valid: true, value: port ? `${host}:${port}` : host }
}
