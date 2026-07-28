import { onMounted, ref } from 'vue'

import { STORAGE } from '../utils/constants'

export type ThemePreference = 'dark' | 'light' | 'auto'
export type ResolvedTheme = Exclude<ThemePreference, 'auto'>

const currentTheme = ref<ThemePreference>('auto')
const callbacks = new Set<(theme: ResolvedTheme) => void>()
let mediaQuery: MediaQueryList | null = null

function isTheme(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'auto'
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === 'auto' ? getSystemTheme() : theme
}

export function applyTheme(theme: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(theme)
  document.body.classList.remove('dark', 'light')
  if (resolved === 'light') document.body.classList.add('light')
  for (const callback of callbacks) callback(resolved)
  return resolved
}

function ensureSystemThemeListener(): void {
  if (mediaQuery || !window.matchMedia) return
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (currentTheme.value === 'auto') applyTheme('auto')
  })
}

export function useTheme() {
  ensureSystemThemeListener()

  const getPreferredTheme = (): ThemePreference => {
    const stored = localStorage.getItem(STORAGE.THEME_PREFERENCE)
    return isTheme(stored) ? stored : 'dark'
  }

  const setTheme = (theme: ThemePreference): ResolvedTheme => {
    localStorage.setItem(STORAGE.THEME_PREFERENCE, theme)
    currentTheme.value = theme
    return applyTheme(theme)
  }

  const toggleTheme = (): ThemePreference => {
    const themes: readonly ThemePreference[] = ['dark', 'light', 'auto']
    const next = themes[(themes.indexOf(currentTheme.value) + 1) % themes.length]!
    setTheme(next)
    return next
  }

  const initTheme = (): ResolvedTheme => {
    currentTheme.value = getPreferredTheme()
    return applyTheme(currentTheme.value)
  }

  const onThemeChange = (callback: (theme: ResolvedTheme) => void): (() => void) => {
    callbacks.add(callback)
    return () => callbacks.delete(callback)
  }

  onMounted(initTheme)
  return { currentTheme, setTheme, getPreferredTheme, applyTheme, toggleTheme, initTheme, onThemeChange }
}
