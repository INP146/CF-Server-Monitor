import { isRecord } from '../types/domain.js'
import type { DataRecord } from '../types/domain.js'

const THEMES_URL = 'https://raw.githubusercontent.com/huilang-me/CFSM-Theme-Store/refs/heads/main/themes.json'
const CACHE_TTL = 300

interface ThemeRecord extends DataRecord {
  versions: unknown[]
}

interface ThemeStore extends DataRecord {
  schema: unknown
  themes: ThemeRecord[]
}

let cachedThemeStore: ThemeStore | null = null
let cacheTime = 0

const createEmptyThemeStore = (): ThemeStore => ({ schema: 1, themes: [] })

const normalizeThemeStore = (data: unknown): ThemeStore => {
  if (isRecord(data)) {
    return {
      ...data,
      schema: data.schema || 1,
      themes: Array.isArray(data.themes) ? data.themes.flatMap(theme => {
        if (!isRecord(theme)) return []
        return [{
          ...theme,
          versions: Array.isArray(theme.versions) ? theme.versions : []
        }]
      }) : []
    }
  }

  return createEmptyThemeStore()
}

export async function handleTheme(): Promise<ThemeStore> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedThemeStore && (now - cacheTime) < CACHE_TTL) {
    return cachedThemeStore
  }

  try {
    const res = await fetch(THEMES_URL, {
      headers: { 'User-Agent': 'CFSM-Theme-Store' }
    })

    if (!res.ok) {
      return cachedThemeStore || createEmptyThemeStore()
    }

    const data: unknown = await res.json()
    const themeStore = normalizeThemeStore(data)
    cachedThemeStore = themeStore
    cacheTime = now
    return themeStore
  } catch (e) {
    return cachedThemeStore || createEmptyThemeStore()
  }
}
