import assert from 'node:assert/strict'
import test from 'node:test'

import { computeDashboardStats } from '../src/frontend-next/composables/useDashboard'
import * as dashboardApi from '../src/frontend-next/utils/api'
import { createEmptyMergedData, mergeSiteResult } from '../src/frontend-next/utils/api'
import { normalizeDashboardView, normalizeDisplayMode } from '../src/frontend-next/utils/display-mode'
import { formatBytes } from '../src/frontend-next/utils/format'
import { resolvePlaybackCursor } from '../src/frontend-next/utils/playback'
import { validatePingNode } from '../src/frontend-next/utils/ping-node'
import {
  detectBillingCycle,
  formatBillingPrice,
  normalizePrice,
  renewExpireDateIfNeeded,
} from '../src/frontend-next/utils/server'
import { calcTrafficUsagePercent, formatUptime, getPingColor } from '../src/frontend-next/utils/server-card'
import { normalizeTimestamp } from '../src/frontend-next/utils/time'

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
  }, true, 'Fleet')

  assert.equal(merged.servers[0]?.source, 'https://edge.example.com')
  assert.equal(merged.stats.total, 1)
  assert.equal(merged.stats.online, 1)
  assert.deepEqual(merged.regionStats, { JP: 1 })
  assert.equal(merged.sysConfig.display_mode, 'table')
  assert.equal(merged.sysConfig.show_price, false)
  assert.equal(merged.sysConfig.site_title, 'Fleet')
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
