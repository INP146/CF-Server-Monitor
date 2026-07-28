import { computed, onScopeDispose, ref } from 'vue'

import type {
  BatchUpdateMessage,
  DashboardConfig,
  DashboardServer,
  DashboardStats,
  DashboardView,
  LiveSample,
  LiveSocketController,
  LiveUpdate,
  MergedDashboardData,
} from '../types/dashboard'
import {
  DEFAULT_DASHBOARD_CONFIG,
  fetchConfig,
  fetchServersAll,
  fetchServersAllWithProgress,
} from '../utils/api'
import { getApiBases, getTitle, hasMultipleApiBases } from '../utils/config'
import { DEFAULT_SITE_TITLE, STORAGE, TIME } from '../utils/constants'
import { normalizeDashboardView, normalizeDisplayMode, resolveDisplayMode } from '../utils/display-mode'
import { isServerOnline, toNumber } from '../utils/format'
import { createLiveSocket } from '../utils/live-socket'
import { getPlaybackElapsedMs, resolvePlaybackCursor } from '../utils/playback'
import { normalizeTimestamp } from '../utils/time'

interface BufferedSample {
  serverId: string
  source?: string
  timestamp: number
  data: Record<string, unknown>
  reportTimestamp: number
}

interface QueueOptions {
  replayCachedReport?: boolean
  reportAgeMs?: number
}

const PLAYBACK_TICK_MS = 1_000
const MAX_BUFFER_SAMPLES_PER_SERVER = 600
export const MAX_SERVER_IDS_PER_SOCKET = 500

export const serverKey = (serverId: string, source?: string): string => `${source || ''}\u0000${serverId}`
export function chunkServerIds(ids: readonly string[], size = MAX_SERVER_IDS_PER_SOCKET): string[][] {
  const chunkSize = Math.max(1, Math.floor(size))
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  return Array.from({ length: Math.ceil(uniqueIds.length / chunkSize) }, (_, index) => (
    uniqueIds.slice(index * chunkSize, (index + 1) * chunkSize)
  ))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getSampleData(sample: LiveSample): Record<string, unknown> | null {
  return sample.data ?? sample.payload ?? sample.metrics ?? null
}

export function computeDashboardStats(servers: readonly DashboardServer[], now = Date.now()): {
  stats: DashboardStats
  regionStats: Record<string, number>
  unknownCount: number
} {
  let online = 0
  let globalSpeedIn = 0
  let globalSpeedOut = 0
  let globalNetRx = 0
  let globalNetTx = 0
  let unknownCount = 0
  const regionStats: Record<string, number> = {}

  for (const server of servers) {
    if (isServerOnline(server, now)) {
      online += 1
      globalSpeedIn += toNumber(server.net_in_speed)
      globalSpeedOut += toNumber(server.net_out_speed)
    }
    globalNetRx += toNumber(server.net_rx)
    globalNetTx += toNumber(server.net_tx)

    const region = String(server.region ?? '').trim().toUpperCase()
    if (region) regionStats[region] = (regionStats[region] ?? 0) + 1
    else unknownCount += 1
  }

  return {
    stats: {
      total: servers.length,
      online,
      offline: servers.length - online,
      globalNetRx,
      globalNetTx,
      globalSpeedIn,
      globalSpeedOut,
    },
    regionStats,
    unknownCount,
  }
}

export function useDashboard() {
  const servers = ref<DashboardServer[]>([])
  const stats = ref<DashboardStats>({
    total: 0,
    online: 0,
    offline: 0,
    globalNetRx: 0,
    globalNetTx: 0,
    globalSpeedIn: 0,
    globalSpeedOut: 0,
  })
  const sysConfig = ref<DashboardConfig>({ ...DEFAULT_DASHBOARD_CONFIG })
  const siteConfigs = ref<Record<string, DashboardConfig>>({})
  const regionStats = ref<Record<string, number>>({})
  const unknownCount = ref(0)
  const currentView = ref<DashboardView>('bar')
  const currentFilter = ref('all')
  const isLoading = ref(true)
  const sitesRemaining = ref(0)
  const corsErrorSites = ref<string[]>([])
  const liveConnected = ref(false)
  const now = ref(Date.now())
  const error = ref<Error | null>(null)

  const playbackBuffers = new Map<string, BufferedSample[]>()
  let sockets: LiveSocketController[] = []
  let tickInterval: ReturnType<typeof setInterval> | null = null
  let initialized = false

  const filterOptions = computed<Record<string, number>>(() => {
    const options: Record<string, number> = { all: stats.value.total }
    for (const [code, count] of Object.entries(regionStats.value)) {
      if (code.toLowerCase() !== 'xx') options[code.toLowerCase()] = count
    }
    if (unknownCount.value > 0) options.unknown = unknownCount.value
    return options
  })

  const filteredServers = computed(() => {
    if (currentFilter.value === 'all') return servers.value
    if (currentFilter.value === 'unknown') return servers.value.filter((server) => !server.region)
    return servers.value.filter((server) => String(server.region ?? 'xx').toLowerCase() === currentFilter.value)
  })

  const groupedServers = computed(() => {
    const groups = new Map<string, DashboardServer[]>()
    for (const server of filteredServers.value) {
      const groupName = String(server.server_group || 'Default')
      const group = groups.get(groupName) ?? []
      group.push(server)
      groups.set(groupName, group)
    }
    return Array.from(groups, ([name, groupServers]) => ({ name, servers: groupServers }))
  })

  const getReportTimestamp = (server?: DashboardServer, fallback: number | null = null) =>
    normalizeTimestamp(server?.report_timestamp ?? server?.last_updated, fallback)

  const getSampleTimestamp = (server?: DashboardServer) =>
    normalizeTimestamp(server?.sample_timestamp ?? server?.timestamp ?? server?.last_updated)

  const getDisplayTimestamp = (server?: DashboardServer) =>
    normalizeTimestamp(server?.display_timestamp)

  const withDisplayTiming = (
    server: DashboardServer,
    displayTimestamp: number | null = null,
    currentTimestamp = Date.now(),
  ): DashboardServer => {
    const reportTimestamp = getReportTimestamp(server)
    const sampleTimestamp = getSampleTimestamp(server) ?? displayTimestamp ?? reportTimestamp
    const ownTimestamp = normalizeTimestamp(
      displayTimestamp,
      getDisplayTimestamp(server) ?? sampleTimestamp ?? reportTimestamp,
    )
    const timed: DashboardServer = { ...server, current_timestamp: currentTimestamp }

    if (reportTimestamp) {
      timed.report_timestamp = reportTimestamp
      timed.last_updated = reportTimestamp
    }
    if (!sampleTimestamp || !ownTimestamp) return timed

    return {
      ...timed,
      sample_timestamp: sampleTimestamp,
      display_timestamp: ownTimestamp,
      sample_lag_seconds: Math.max(0, Math.floor((ownTimestamp - sampleTimestamp) / 1_000)),
    }
  }

  const recomputeStats = (currentTimestamp = Date.now()) => {
    const computedStats = computeDashboardStats(servers.value, currentTimestamp)
    stats.value = computedStats.stats
    regionStats.value = computedStats.regionStats
    unknownCount.value = computedStats.unknownCount
  }

  const applyServerSample = (sample: BufferedSample, displayTimestamp: number) => {
    const key = serverKey(sample.serverId, sample.source)
    const index = servers.value.findIndex((server) => serverKey(server.id, server.source) === key)
    const existing = index >= 0 ? servers.value[index] : undefined
    const reportTimestamp = normalizeTimestamp(sample.reportTimestamp, getReportTimestamp(existing, now.value))!
    const merged = withDisplayTiming({
      ...existing,
      ...sample.data,
      id: sample.serverId,
      source: sample.source ?? existing?.source,
      name: existing?.name ?? sample.serverId,
      report_timestamp: reportTimestamp,
      last_updated: reportTimestamp,
      sample_timestamp: sample.timestamp,
      timestamp: sample.timestamp,
    }, displayTimestamp, now.value)

    if (index >= 0) servers.value[index] = merged
    else servers.value.push(merged)
  }

  const applyPlaybackSamplesForServer = (key: string, displayTimestamp?: number) => {
    const samples = playbackBuffers.get(key)
    if (!samples?.length) return

    const first = samples[0]!
    const server = servers.value.find((item) => serverKey(item.id, item.source) === serverKey(first.serverId, first.source))
    const ownTimestamp = normalizeTimestamp(displayTimestamp, getDisplayTimestamp(server))
    if (!ownTimestamp) return

    let selected: BufferedSample | undefined
    while (samples.length && samples[0]!.timestamp <= ownTimestamp) selected = samples.shift()
    if (selected) applyServerSample(selected, ownTimestamp)
    if (!samples.length) playbackBuffers.delete(key)
  }

  const queueLiveSamples = (
    serverId: string,
    samples: readonly LiveSample[],
    reportTimestamp: number,
    options: QueueOptions = {},
    source?: string,
  ) => {
    const normalized = samples.flatMap((sample): BufferedSample[] => {
      const data = getSampleData(sample)
      const timestamp = normalizeTimestamp(
        sample.ts ?? sample.timestamp
          ?? data?.sample_timestamp as string | number | null | undefined
          ?? data?.last_updated as string | number | null | undefined
          ?? data?.timestamp as string | number | null | undefined,
      )
      return data && timestamp ? [{ serverId, source, timestamp, data, reportTimestamp }] : []
    }).sort((left, right) => left.timestamp - right.timestamp)
    if (!normalized.length) return

    const key = serverKey(serverId, source)
    const current = servers.value.find((server) => serverKey(server.id, server.source) === key)
    const currentSampleTimestamp = getSampleTimestamp(current)
    const incoming = options.replayCachedReport
      ? normalized
      : normalized.filter((sample) => !currentSampleTimestamp || sample.timestamp > currentSampleTimestamp)
    if (!incoming.length) return

    const playbackStart = resolvePlaybackCursor(incoming[0]!.timestamp, getDisplayTimestamp(current), options)
    if (playbackStart === null) return

    const uniqueSamples = Array.from(
      new Map(incoming.map((sample) => [sample.timestamp, sample])).values(),
    ).slice(-MAX_BUFFER_SAMPLES_PER_SERVER)

    if (uniqueSamples.length === 1) {
      playbackBuffers.delete(key)
      applyServerSample(uniqueSamples[0]!, playbackStart)
      return
    }

    playbackBuffers.set(key, uniqueSamples)
    applyPlaybackSamplesForServer(key, playbackStart)
  }

  const queueLiveMessage = (value: unknown, options: QueueOptions = {}, source?: string) => {
    if (!isRecord(value) || value.type !== 'batchUpdate' || !Array.isArray(value.updates)) return
    const message = value as unknown as BatchUpdateMessage
    const messageReportTimestamp = normalizeTimestamp(message.ts, Date.now())!

    for (const update of message.updates) {
      if (!update?.serverId || !Array.isArray(update.samples)) continue
      const reportTimestamp = normalizeTimestamp(
        update.reportTs ?? update.report_timestamp,
        messageReportTimestamp,
      )!
      queueLiveSamples(update.serverId, update.samples, reportTimestamp, {
        ...options,
        reportAgeMs: options.replayCachedReport ? update.reportAgeMs : 0,
      }, update.source || source)
    }
  }

  const replayLatestReports = (updates: readonly LiveUpdate[]) => {
    if (updates.length) {
      queueLiveMessage({ type: 'batchUpdate', ts: Date.now(), updates }, { replayCachedReport: true })
    }
  }

  const mergeServers = (rawServers: readonly DashboardServer[]) => {
    const existingById = new Map(servers.value.map((server) => [serverKey(server.id, server.source), server]))
    return rawServers.map((server) => {
      const previous = existingById.get(serverKey(server.id, server.source))
      const sampleTimestamp = normalizeTimestamp(
        server.sample_timestamp ?? server.timestamp ?? server.last_updated,
        getSampleTimestamp(previous),
      )
      const reportTimestamp = normalizeTimestamp(
        server.report_timestamp ?? server.last_updated,
        getReportTimestamp(previous),
      )
      return withDisplayTiming(
        { ...previous, ...server, sample_timestamp: sampleTimestamp, report_timestamp: reportTimestamp },
        sampleTimestamp,
        now.value,
      )
    })
  }

  const applyDashboardData = (data: MergedDashboardData) => {
    servers.value = mergeServers(data.servers)
    siteConfigs.value = Object.fromEntries(Object.entries(data.siteConfigs).map(([baseUrl, config]) => [baseUrl, { ...config }]))
    const resolvedConfig = hasMultipleApiBases()
      ? data.siteConfigs[getApiBases()[0]!]
      : data.sysConfig
    if (!resolvedConfig) {
      recomputeStats(now.value)
      return
    }
    sysConfig.value = {
      ...sysConfig.value,
      ...resolvedConfig,
      display_mode: normalizeDisplayMode(resolvedConfig.display_mode),
      site_title: sysConfig.value.site_title || resolvedConfig.site_title,
    }
    recomputeStats(now.value)
  }

  const loadDashboardConfig = async () => {
    const config = await fetchConfig()
    if (!config) return
    const localTitle = getTitle().trim()
    const remoteTitle = String(config.site_title ?? '').trim()
    sysConfig.value = {
      ...sysConfig.value,
      site_title: hasMultipleApiBases() && localTitle
        ? localTitle
        : remoteTitle || sysConfig.value.site_title,
      display_mode: resolveDisplayMode(config),
    }
  }

  const refresh = async () => {
    isLoading.value = true
    playbackBuffers.clear()
    error.value = null
    const bases = getApiBases()
    sitesRemaining.value = bases.length
    corsErrorSites.value = []

    try {
      if (bases.length > 1) {
        let completedSites = 0
        const data = await fetchServersAllWithProgress((progress) => {
          completedSites += 1
          applyDashboardData(progress)
          corsErrorSites.value = (progress.siteErrors ?? []).map((item) => `${item.baseUrl}: ${item.message}`)
          sitesRemaining.value = Math.max(0, bases.length - completedSites)
          isLoading.value = false
        })
        replayLatestReports(data.latestReportUpdates)
      } else {
        const data = await fetchServersAll()
        applyDashboardData(data)
        replayLatestReports(data.latestReportUpdates)
        corsErrorSites.value = (data.siteErrors ?? []).map((item) => `${item.baseUrl}: ${item.message}`)
        sitesRemaining.value = 0
      }
    } catch (caught) {
      error.value = caught instanceof Error ? caught : new Error(String(caught))
    } finally {
      isLoading.value = false
      startLiveSockets()
    }
  }

  const advanceClocks = () => {
    const currentTimestamp = now.value
    servers.value = servers.value.map((server) => {
      const reportTimestamp = getReportTimestamp(server)
      const displayTimestamp = getDisplayTimestamp(server) ?? getSampleTimestamp(server) ?? reportTimestamp
      const elapsed = getPlaybackElapsedMs(currentTimestamp, server.current_timestamp, PLAYBACK_TICK_MS)
      const nextDisplayTimestamp = isServerOnline(server, currentTimestamp) && displayTimestamp
        ? displayTimestamp + elapsed
        : displayTimestamp
      return withDisplayTiming(server, nextDisplayTimestamp, currentTimestamp)
    })

    for (const key of playbackBuffers.keys()) applyPlaybackSamplesForServer(key)
  }

  const tick = () => {
    now.value = Date.now()
    advanceClocks()
    recomputeStats(now.value)
  }

  const stopLiveSockets = () => {
    for (const socket of sockets) socket.close()
    sockets = []
    liveConnected.value = false
  }

  const startLiveSockets = () => {
    stopLiveSockets()
    const bases = getApiBases()
    const idsByIndex = new Map<number, string[]>()

    for (const server of servers.value) {
      if (!server.id) continue
      const index = server.source ? bases.indexOf(server.source) : 0
      if (index < 0) continue
      const ids = idsByIndex.get(index) ?? []
      ids.push(server.id)
      idsByIndex.set(index, ids)
    }

    sockets = bases.flatMap((_, index) => {
      const ids = idsByIndex.get(index)
      if (!ids?.length) return []
      return chunkServerIds(ids).map((serverIds) => createLiveSocket('all', {
        replay: false,
        onMessage: (message) => queueLiveMessage(message, {}, bases[index]),
        onStatus: () => {
          liveConnected.value = sockets.some((socket) => socket.isConnected)
        },
      }, index, serverIds))
    })
  }

  const switchView = (view: unknown) => {
    currentView.value = normalizeDashboardView(view, sysConfig.value.display_mode)
    localStorage.setItem(STORAGE.VIEW_PREFERENCE, currentView.value)
  }

  const setFilter = (filter: unknown) => {
    currentFilter.value = String(filter ?? 'all').toLowerCase()
  }

  const initialize = async () => {
    if (initialized) return
    initialized = true
    isLoading.value = true
    sysConfig.value.site_title = getTitle().trim() || DEFAULT_SITE_TITLE
    await loadDashboardConfig()

    const savedView = localStorage.getItem(STORAGE.VIEW_PREFERENCE)
    currentView.value = normalizeDashboardView(savedView, sysConfig.value.display_mode)
    await refresh()
    tick()
    tickInterval = setInterval(tick, PLAYBACK_TICK_MS)
  }

  const dispose = () => {
    if (tickInterval) clearInterval(tickInterval)
    tickInterval = null
    stopLiveSockets()
    playbackBuffers.clear()
    initialized = false
  }

  onScopeDispose(dispose)

  return {
    servers,
    stats,
    sysConfig,
    siteConfigs,
    regionStats,
    unknownCount,
    currentView,
    currentFilter,
    isLoading,
    sitesRemaining,
    corsErrorSites,
    liveConnected,
    now,
    error,
    filterOptions,
    filteredServers,
    groupedServers,
    initialize,
    refresh,
    dispose,
    switchView,
    setFilter,
  }
}
