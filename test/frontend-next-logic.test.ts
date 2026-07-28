import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

import { chunkServerIds, computeDashboardStats, serverKey } from '../src/frontend-next/composables/useDashboard'
import {
  clearAuthToken,
  getAuthToken,
  getTurnstileVerification,
  isAdminLoggedIn,
  normalizeApiIndex,
  setAuthToken,
  setTurnstileVerificationForBase,
} from '../src/frontend-next/utils/auth'
import * as dashboardApi from '../src/frontend-next/utils/api'
import { createEmptyMergedData, mergeSiteResult } from '../src/frontend-next/utils/api'
import { normalizeDashboardView, normalizeDisplayMode } from '../src/frontend-next/utils/display-mode'
import { formatBytes } from '../src/frontend-next/utils/format'
import { resolvePlaybackCursor } from '../src/frontend-next/utils/playback'
import { setApiBases } from '../src/frontend-next/utils/config'
import { getPostLoginTarget, normalizeInternalRedirect, withApiIndex } from '../src/frontend-next/utils/routing'
import { validatePingNode } from '../src/frontend-next/utils/ping-node'
import {
  detectBillingCycle,
  formatBillingPrice,
  normalizePrice,
  renewExpireDateIfNeeded,
} from '../src/frontend-next/utils/server'
import { calcTrafficUsagePercent, formatUptime, getPingColor } from '../src/frontend-next/utils/server-card'
import { normalizeTimestamp } from '../src/frontend-next/utils/time'
import { createDefaultSettings, createManagedServers } from '../src/frontend-next/data/admin'
import {
  applyAdminSettings,
  toAdminServerPayload,
  toAdminSettingsPayload,
  toManagedServer,
} from '../src/frontend-next/utils/admin-api'
import { useTurnstile } from '../src/frontend-next/composables/useTurnstile'
import {
  buildInstallCommand,
  buildUninstallCommand,
  createMetricSeries,
  getInstallerScript,
  parseServerBackup,
  serializeServers,
} from '../src/frontend-next/utils/mock-admin'
import { historyNumbers, toDisplayServer } from '../src/frontend-next/utils/view-model'
import { getNextTurnstileSite, requiresFreshLoginTurnstileToken } from '../src/frontend-next/utils/turnstile'
import { http } from '../src/frontend-next/utils/http'
import { normalizeLiveSocketScope } from '../src/frontend-next/utils/live-socket'

test('normalizes legacy display mode values', () => {
  assert.equal(normalizeDisplayMode('list'), 'table')
  assert.equal(normalizeDashboardView('card', 'ring'), 'ring')
  assert.equal(normalizeDashboardView('unsupported', 'table'), 'table')
})

test('keeps every legacy dashboard API export available', () => {
  const expectedExports = [
    'getApiBases', 'getWsBase', 'createLiveSocket', 'getFlagRegionCode', 'formatBytes',
    'isServerOnline', 'fetchServers', 'fetchServersAll', 'fetchServersAllWithProgress',
    'fetchServerDetail', 'fetchAllHistory', 'adminApi', 'login', 'logout', 'fetchConfig',
    'upgradeDatabase', 'clearHistory', 'isAdminLoggedIn',
  ]
  for (const exportName of expectedExports) {
    assert.equal(typeof dashboardApi[exportName as keyof typeof dashboardApi], 'function', exportName)
  }
})

test('isolates admin sessions by API site and migrates the legacy first-site token', () => {
  const values = new Map<string, string>()
  const storage = {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key) },
    setItem: (key: string, value: string) => { values.set(key, String(value)) },
  }
  const previousWindow = globalThis.window
  const previousStorage = globalThis.localStorage
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { protocol: 'https:', host: 'app.example.com', origin: 'https://app.example.com' } },
  })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

  try {
    setApiBases(['https://one.example.com', 'https://two.example.com'])
    storage.setItem('jwt_token', 'legacy-token')
    assert.equal(getAuthToken(0), 'legacy-token')
    assert.equal(storage.getItem('jwt_token'), null)

    setAuthToken('second-token', 1)
    assert.equal(getAuthToken(0), 'legacy-token')
    assert.equal(getAuthToken(1), 'second-token')
    assert.equal(isAdminLoggedIn(1), true)
    assert.equal(normalizeApiIndex('99'), 0)

    setTurnstileVerificationForBase('https://one.example.com', 'first-verification')
    setTurnstileVerificationForBase('https://two.example.com', 'second-verification')
    assert.equal(getTurnstileVerification(0), 'first-verification')
    assert.equal(getTurnstileVerification(1), 'second-verification')

    clearAuthToken(1)
    assert.equal(isAdminLoggedIn(1), false)
    assert.equal(isAdminLoggedIn(0), true)
  } finally {
    setApiBases(['https://app.example.com'])
    Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage })
  }
})

test('keeps authentication redirects internal and bound to the selected API site', () => {
  assert.equal(getPostLoginTarget('/server/node-1?range=24#chart', 1), '/server/node-1?range=24&api=1#chart')
  assert.equal(getPostLoginTarget('/admin/panel?api=0', 2), '/admin/panel?api=2')
  assert.equal(getPostLoginTarget('//evil.example/path', 1), '/admin/panel?api=1')
  assert.equal(normalizeInternalRedirect('/admin'), '/admin/panel')
  assert.equal(withApiIndex('/admin/panel?tab=settings', 3), '/admin/panel?tab=settings&api=3')
})

test('does not force JSON preflights for bodyless public GET requests', async () => {
  const previousWindow = globalThis.window
  const previousStorage = globalThis.localStorage
  const previousFetch = globalThis.fetch
  const values = new Map<string, string>()
  const storage = {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key) },
    setItem: (key: string, value: string) => { values.set(key, String(value)) },
  }
  let capturedHeaders = new Headers()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { protocol: 'https:', host: 'app.example.com', origin: 'https://app.example.com' } },
  })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  globalThis.fetch = async (_input, init) => {
    capturedHeaders = new Headers(init?.headers)
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    setApiBases(['https://app.example.com'])
    await http.get('/api/servers', {
      includeAuth: false,
      includeTurnstile: false,
      includeTurnstileVerified: false,
    })
    assert.equal(capturedHeaders.has('Content-Type'), false)
    await http.post('/admin/api', { action: 'login' }, {
      includeAuth: false,
      includeTurnstile: false,
      includeTurnstileVerified: false,
    })
    assert.equal(capturedHeaders.get('Content-Type'), 'application/json')
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage })
    globalThis.fetch = previousFetch
  }
})

test('notifies the access gate when Turnstile expires during a non-redirecting request', async () => {
  const previousWindow = globalThis.window
  const previousStorage = globalThis.localStorage
  const previousFetch = globalThis.fetch
  const values = new Map<string, string>()
  const storage = {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key) },
    setItem: (key: string, value: string) => { values.set(key, String(value)) },
  }
  const eventTarget = new EventTarget()
  Object.assign(eventTarget, {
    location: { protocol: 'https:', host: 'app.example.com', origin: 'https://app.example.com' },
  })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: eventTarget })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'verificationFailed' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
  let expiredEvents = 0
  eventTarget.addEventListener('edgeprobe:turnstile-expired', () => { expiredEvents += 1 })

  try {
    setApiBases(['https://app.example.com'])
    await assert.rejects(() => dashboardApi.fetchAllHistory('server-id', 1), /verificationFailed/)
    assert.equal(expiredEvents, 1)
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage })
    globalThis.fetch = previousFetch
  }
})

test('normalizes timestamps and formats byte values', () => {
  assert.equal(normalizeTimestamp(1_700_000_000), 1_700_000_000_000)
  assert.equal(normalizeTimestamp(1_700_000_000_000), 1_700_000_000_000)
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(-100), '0 B')
})

test('computes online totals, traffic and region counts from servers', () => {
  const now = 1_700_000_000_000
  const result = computeDashboardStats([
    {
      id: 'online',
      region: 'us',
      report_timestamp: now - 1_000,
      net_in_speed: '10',
      net_out_speed: 20,
      net_rx: 100,
      net_tx: 200,
    },
    {
      id: 'offline',
      report_timestamp: now - 300_001,
      net_in_speed: 999,
      net_out_speed: 999,
      net_rx: 300,
      net_tx: 400,
    },
  ], now)

  assert.deepEqual(result.stats, {
    total: 2,
    online: 1,
    offline: 1,
    globalNetRx: 400,
    globalNetTx: 600,
    globalSpeedIn: 10,
    globalSpeedOut: 20,
  })
  assert.deepEqual(result.regionStats, { US: 1 })
  assert.equal(result.unknownCount, 1)
})

test('keeps identical server IDs isolated by source site', () => {
  assert.notEqual(serverKey('same-id', 'https://one.example.com'), serverKey('same-id', 'https://two.example.com'))
  assert.equal(serverKey('same-id', 'https://one.example.com'), serverKey('same-id', 'https://one.example.com'))
})

test('chunks large WebSocket subscriptions and preserves case-sensitive server IDs', () => {
  const ids = Array.from({ length: 501 }, (_, index) => `server-${index}`)
  const chunks = chunkServerIds([...ids, ids[0]!])
  assert.deepEqual(chunks.map((chunk) => chunk.length), [500, 1])
  assert.equal(normalizeLiveSocketScope('ALL'), 'all')
  assert.equal(normalizeLiveSocketScope('ABCDEF00-1234-5678-9ABC-DEF012345678'), 'ABCDEF00-1234-5678-9ABC-DEF012345678')
})

test('merges a remote dashboard response and records its source', () => {
  const merged = createEmptyMergedData()
  mergeSiteResult(merged, {
    status: 200,
    baseUrl: 'https://edge.example.com',
    data: {
      servers: [{ id: 'server-1', name: 'Tokyo' }],
      stats: { total: 1, online: 1 },
      regionStats: { JP: 1 },
      sysConfig: { display_mode: 'table', show_price: false },
    },
  }, true, 'Fleet', 'https://edge.example.com')

  assert.equal(merged.servers[0]?.source, 'https://edge.example.com')
  assert.equal(merged.stats.total, 1)
  assert.equal(merged.stats.online, 1)
  assert.deepEqual(merged.regionStats, { JP: 1 })
  assert.equal(merged.sysConfig.display_mode, 'table')
  assert.equal(merged.sysConfig.show_price, false)
  assert.equal(merged.sysConfig.site_title, 'Fleet')
  assert.equal(merged.siteConfigs['https://edge.example.com']?.show_price, false)
})

test('keeps multi-site display settings isolated and independent of response order', () => {
  const build = (order: string[]) => {
    const merged = createEmptyMergedData()
    for (const baseUrl of order) {
      mergeSiteResult(merged, {
        status: 200,
        baseUrl,
        data: {
          servers: [],
          sysConfig: baseUrl.includes('one')
            ? { display_mode: 'ring', show_price: false, show_tf: false }
            : { display_mode: 'table', show_price: true, show_tf: true },
        },
      }, true, 'Fleet', 'https://one.example.com')
    }
    return merged
  }
  const first = build(['https://one.example.com', 'https://two.example.com'])
  const second = build(['https://two.example.com', 'https://one.example.com'])
  assert.deepEqual(first.sysConfig, second.sysConfig)
  assert.equal(second.sysConfig.display_mode, 'ring')
  assert.equal(second.sysConfig.show_price, false)
  assert.equal(second.siteConfigs['https://two.example.com']?.show_price, true)
  assert.equal(second.siteConfigs['https://two.example.com']?.show_tf, true)
})

test('positions live playback at the current or cached report cursor', () => {
  assert.equal(resolvePlaybackCursor(1_000, 2_000), 2_000)
  assert.equal(resolvePlaybackCursor(1_000, null), 1_000)
  assert.equal(resolvePlaybackCursor(1_000, 5_000, {
    replayCachedReport: true,
    reportAgeMs: 750,
  }), 1_750)
})

test('normalizes billing data and renews expired dates', () => {
  assert.equal(normalizePrice('HK$ 1,234.5/year'), '1234.50')
  assert.equal(detectBillingCycle('HK$ 10 / 2 years'), 'two_years')
  assert.equal(formatBillingPrice({ price: '10/year', currency: '$', billing_cycle: 'year' }, 'en'), '$10.00/Y')
  assert.deepEqual(renewExpireDateIfNeeded('2024-01-31', 'month', true, Date.UTC(2024, 1, 1)), {
    expire_date: '2024-02-29',
    renewed: true,
  })
})

test('validates ping nodes and derives card metrics', () => {
  assert.deepEqual(validatePingNode('EXAMPLE.com:080'), { valid: true, value: 'example.com:80' })
  assert.deepEqual(validatePingNode('999.1.1.1'), { valid: false })
  assert.equal(calcTrafficUsagePercent({
    id: 'server',
    net_rx_monthly: 1024 ** 3,
    net_tx_monthly: 1024 ** 3,
    traffic_limit: 4,
  }), 50)
  assert.equal(formatUptime(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2, 2), 'en'), '1d 2h')
  assert.equal(getPingColor(150), 'var(--accent-yellow)')
})

test('builds platform-specific agent commands with API credentials', () => {
  const server = {
    ...createManagedServers()[0]!,
    customCt: 'ct.example.com',
    customCu: 'cu.example.com',
    customCm: 'cm.example.com',
    customBd: 'bd.example.com',
    rxCorrection: 1.5,
    txCorrection: 2.5,
  }
  const linux = buildInstallCommand(server, 'linux', 'https://edge.example.com/', 'secret')
  assert.match(linux, /install\.sh' \| bash -s install/)
  assert.match(linux, /-id='lax-core-01'.*-secret='secret'.*-url='https:\/\/edge\.example\.com\/update'/)
  assert.match(linux, /-collect_interval=0.*-interval=60.*-reset_day=1.*-auto_update=1/)
  assert.match(linux, /-ct='ct\.example\.com'.*-cu='cu\.example\.com'.*-cm='cm\.example\.com'.*-bd='bd\.example\.com'/)
  assert.match(linux, /-rx_correction=1\.5.*-tx_correction=2\.5/)

  const windows = buildInstallCommand(server, 'windows', 'https://edge.example.com', 'secret')
  assert.match(windows, /cf-server-monitor\.ps1'.* install -Id 'lax-core-01'/)
  assert.match(windows, /-CollectInterval 0.*-ReportInterval 60.*-ResetDay 1.*-AutoUpdate 1/)
  assert.match(windows, /-RxCorrection 1\.5.*-TxCorrection 2\.5/)
  assert.match(buildInstallCommand(server, 'mac', 'https://edge.example.com', 'secret'), /install-mac\.sh' \| sudo bash -s install/)
  assert.match(buildUninstallCommand(server, 'openwrt', 'https://edge.example.com'), /install-openwrt\.sh' \| sh -s uninstall/)
  assert.match(buildUninstallCommand(server, 'windows', 'https://edge.example.com'), /cf-server-monitor\.ps1'.* uninstall/)

  for (const target of ['linux', 'alpine', 'openwrt', 'mac', 'synology', 'windows'] as const) {
    assert.equal(existsSync(new URL(`../public/${getInstallerScript(target)}`, import.meta.url)), true, target)
  }
  for (const asset of ['leaflet.js', 'leaflet.css', 'world.zh.json']) {
    assert.equal(existsSync(new URL(`../public/${asset}`, import.meta.url)), true, asset)
  }
})

test('selects the next unverified Turnstile site and always requires a fresh login token', () => {
  const sites = [
    { index: 0, data: {}, siteKey: 'shared', verified: true },
    { index: 1, data: {}, siteKey: 'shared', verified: false },
  ]
  assert.equal(getNextTurnstileSite(sites)?.index, 1)
  assert.equal(requiresFreshLoginTurnstileToken(true, false), true)
  assert.equal(requiresFreshLoginTurnstileToken(false, 'true'), true)
  assert.equal(requiresFreshLoginTurnstileToken(false, false), false)
})

test('uses the official Turnstile error and expiry callback keys', () => {
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  let options: Record<string, unknown> | undefined
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      turnstile: {
        render: (_container: string | HTMLElement, value: Record<string, unknown>) => { options = value; return 'widget-id' },
        remove: () => undefined,
        reset: () => undefined,
      },
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { querySelector: () => null },
  })

  try {
    useTurnstile().renderTurnstile('#turnstile', 'site-key')
    assert.equal(typeof options?.['error-callback'], 'function')
    assert.equal(typeof options?.['expired-callback'], 'function')
    assert.equal('errorCallback' in (options || {}), false)
    assert.equal('expiredCallback' in (options || {}), false)
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument })
  }
})

test('preserves history timestamps and gaps instead of shifting chart series', () => {
  assert.deepEqual(historyNumbers([
    { timestamp: 1_700_000_000, cpu: 10 },
    { timestamp: 1_700_000_060, cpu: null },
    { timestamp: 1_700_000_120, cpu: 30 },
  ], 'cpu'), [
    { timestamp: 1_700_000_000_000, value: 10 },
    { timestamp: 1_700_000_060_000, value: null },
    { timestamp: 1_700_000_120_000, value: 30 },
  ])
})

test('rejects a dashboard load when every configured site fails', async () => {
  const original = http.getAll
  http.getAll = async () => [{ status: 503, baseUrl: 'https://down.example.com', error: 'Unavailable' }]
  try {
    await assert.rejects(() => dashboardApi.fetchServersAll(), /Unavailable/)
  } finally {
    http.getAll = original
  }
})

test('maps dashboard and admin API records into the new frontend models', () => {
  const now = 1_700_000_000_000
  const record = {
    id: 'server-id',
    name: 'Tokyo',
    region: 'JP',
    tags: 'Core,IPv6',
    last_updated: now - 1_000,
    is_online: true,
    cpu: '24.4',
    ram_used: 2,
    ram_total: 4,
    disk_used: 30,
    disk_total: 100,
    net_in_speed: 1024,
    net_out_speed: 2048,
    ping_ct: 42,
    server_group: 'Core',
    price: '12',
    currency: '$',
    billing_cycle: 'month',
    expire_date: '2027-12-31',
    traffic_limit: 10,
    net_rx_monthly: 1024,
    net_tx_monthly: 2048,
    is_hidden: '1',
    auto_update: '1',
  }
  const display = toDisplayServer(record, now)
  assert.equal(display.status, 'online')
  assert.equal(display.memory, 50)
  assert.equal(display.download, '1 KB/s')
  assert.equal(display.group, 'Core')
  assert.equal(display.priceText, '$12.00/月')
  assert.equal(display.expireDate, '2027-12-31')
  assert.equal(display.trafficUsed, '3 KB')

  const managed = toManagedServer(record, now)
  assert.equal(managed.enabled, false)
  assert.equal(managed.autoUpdate, true)
  assert.equal(managed.rxCorrection, null)
  assert.equal(managed.txCorrection, null)
  assert.equal(toAdminServerPayload(managed).is_hidden, true)
  assert.equal(toAdminServerPayload(managed).rx_correction, null)
  assert.equal(toAdminServerPayload(managed).tx_correction, null)
  assert.doesNotMatch(buildInstallCommand(managed, 'linux'), /-rx_correction|-tx_correction/)
})

test('maps backend settings without exposing write-only secrets', () => {
  const settings = createDefaultSettings()
  applyAdminSettings(settings, {
    site_title: 'Fleet',
    display_mode: 'table',
    show_price: 'false',
    turnstile_enabled: 'true',
    cloudflare_account_id: 'account-id',
    custom_head: '<meta name="custom" content="yes">',
    custom_script: 'window.custom = true',
  })
  assert.equal(settings.siteTitle, 'Fleet')
  assert.equal(settings.defaultView, 'table')
  assert.equal(settings.showPrice, false)
  assert.equal(settings.turnstileEnabled, true)
  assert.equal(settings.cloudflareAccountId, 'account-id')
  assert.equal(settings.customHead, '<meta name="custom" content="yes">')
  assert.equal(settings.customScript, 'window.custom = true')
  const payload = toAdminSettingsPayload(settings)
  assert.equal(payload.custom_head, '<meta name="custom" content="yes">')
  assert.equal(payload.custom_script, 'window.custom = true')
})

test('round-trips server backup data and rejects non-array payloads', () => {
  const servers = createManagedServers().slice(0, 2)
  assert.deepEqual(parseServerBackup(serializeServers(servers)), servers)
  assert.throws(() => parseServerBackup('{"id":"invalid"}'), /服务器数组/)
})

test('creates stable bounded metric samples for static charts', () => {
  const samples = createMetricSeries(2, 25, 5, 12)
  assert.equal(samples.length, 12)
  assert.ok(samples.every((value) => value >= 0))
  assert.deepEqual(samples, createMetricSeries(2, 25, 5, 12))
})
