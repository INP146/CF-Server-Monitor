import type {
  BatchUpdateMessage,
  LiveSample,
  LiveSocketController,
  LiveSocketStatus,
} from '../types/dashboard'
import { getWebsocketBase } from './config'
import { TIME } from './constants'
import { normalizeTimestamp } from './time'

interface ReplayUpdate {
  serverId: string
  data: Record<string, unknown>
  ts: number
}

export interface LiveSocketHandlers {
  replay?: boolean
  onUpdate?: (update: ReplayUpdate) => void
  onStatus?: (status: LiveSocketStatus) => void
  onMessage?: (message: unknown) => void
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function sampleData(sample: LiveSample): Record<string, unknown> | null {
  return sample.data ?? sample.payload ?? sample.metrics ?? null
}

function parseBatchMessage(value: unknown): BatchUpdateMessage | null {
  const message = asRecord(value)
  if (message?.type !== 'batchUpdate' || !Array.isArray(message.updates)) return null
  return message as unknown as BatchUpdateMessage
}

export function createLiveSocket(
  subscribe = 'all',
  handlers: LiveSocketHandlers = {},
  apiIndex = 0,
  serverIds: readonly string[] = [],
): LiveSocketController {
  const scope = subscribe.toLowerCase()
  const replayTimers = new Set<ReturnType<typeof setTimeout>>()
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay: number = TIME.RECONNECT_INITIAL_DELAY_MS
  let reconnectAttempts = 0
  let manualClose = false
  let connected = false
  let connectionId = 0

  const setStatus = (nextConnected: boolean, reason = '') => {
    connected = nextConnected
    handlers.onStatus?.({ connected, reason })
  }

  const clearTimers = () => {
    for (const timer of replayTimers) clearTimeout(timer)
    replayTimers.clear()
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  const emitUpdate = (update: ReplayUpdate) => {
    const receiveTimestamp = Date.now()
    const sampleTimestamp = normalizeTimestamp(
      update.data.sample_timestamp as string | number | null | undefined
        ?? update.data.last_updated as string | number | null | undefined
        ?? update.data.timestamp as string | number | null | undefined
        ?? update.ts,
      receiveTimestamp,
    )!

    handlers.onUpdate?.({
      ...update,
      data: {
        ...update.data,
        sample_timestamp: sampleTimestamp,
        last_updated: receiveTimestamp,
        timestamp: receiveTimestamp,
      },
    })
  }

  const replayBatch = (value: unknown) => {
    const message = parseBatchMessage(value)
    if (!message) return

    for (const update of message.updates) {
      const events = update.samples.flatMap((sample): ReplayUpdate[] => {
        const data = sampleData(sample)
        if (!data) return []
        const timestamp = normalizeTimestamp(
          sample.ts ?? sample.timestamp
            ?? data.last_updated as string | number | null | undefined
            ?? message.ts,
          Date.now(),
        )!
        return [{ serverId: update.serverId, data, ts: timestamp }]
      }).sort((left, right) => left.ts - right.ts)

      const firstTimestamp = events[0]?.ts
      if (firstTimestamp === undefined) continue
      for (const event of events) {
        const delay = Math.max(0, Math.min(event.ts - firstTimestamp, 120_000))
        const timer = setTimeout(() => {
          replayTimers.delete(timer)
          emitUpdate(event)
        }, delay)
        replayTimers.add(timer)
      }
    }
  }

  const scheduleReconnect = () => {
    if (manualClose || reconnectTimer || reconnectAttempts >= TIME.MAX_RECONNECT_ATTEMPTS) {
      if (reconnectAttempts >= TIME.MAX_RECONNECT_ATTEMPTS) setStatus(false, 'max reconnect attempts reached')
      return
    }

    const delay = reconnectDelay
    reconnectDelay = Math.min(reconnectDelay * 2, TIME.RECONNECT_MAX_DELAY_MS)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      reconnectAttempts += 1
      connect()
    }, delay)
  }

  const connect = () => {
    manualClose = false
    const activeConnectionId = ++connectionId
    try {
      socket = new WebSocket(`${getWebsocketBase(apiIndex)}/api/ws?subscribe=${encodeURIComponent(scope)}`)
    } catch {
      setStatus(false, 'WebSocket not supported')
      scheduleReconnect()
      return
    }

    socket.addEventListener('open', () => {
      if (activeConnectionId !== connectionId) return
      reconnectDelay = TIME.RECONNECT_INITIAL_DELAY_MS
      reconnectAttempts = 0
      socket?.send(JSON.stringify({ type: 'subscribe', scope, ids: serverIds }))
      setStatus(true, 'connected')
    })

    socket.addEventListener('message', (event) => {
      if (activeConnectionId !== connectionId) return
      if (typeof event.data !== 'string') return
      try {
        const message: unknown = JSON.parse(event.data)
        if (handlers.replay !== false) replayBatch(message)
        handlers.onMessage?.(message)
      } catch {
        // Ignore malformed messages while keeping the connection alive.
      }
    })

    socket.addEventListener('close', () => {
      if (activeConnectionId !== connectionId) return
      setStatus(false, 'disconnected')
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      if (activeConnectionId !== connectionId) return
      setStatus(false, 'error')
      socket?.close()
    })
  }

  connect()

  return {
    close() {
      manualClose = true
      clearTimers()
      connectionId += 1
      socket?.close()
      socket = null
      setStatus(false, 'closed')
    },
    reconnect() {
      manualClose = true
      clearTimers()
      connectionId += 1
      socket?.close()
      socket = null
      reconnectAttempts = 0
      reconnectDelay = TIME.RECONNECT_INITIAL_DELAY_MS
      manualClose = false
      connect()
    },
    get isConnected() {
      return connected
    },
  }
}
