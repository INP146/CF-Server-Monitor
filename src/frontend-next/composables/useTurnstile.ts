import { ref, type Ref } from 'vue'

import {
  clearTurnstileToken,
  fetchTurnstileConfigByIndex,
  getTurnstileToken,
  hasSharedTurnstileVerified,
  isTurnstileValueEnabled,
  loadTurnstileScript,
  setTurnstileToken,
} from '../utils/turnstile'

export interface TurnstileCallbacks {
  onSuccess?: (token: string) => void
  onError?: () => void
  onExpired?: () => void
}

export function useTurnstile() {
  const turnstileEnabled = ref(false)
  const turnstileLoginEnabled = ref(false)
  const turnstileSiteKey = ref('')
  const turnstileToken = ref('')
  const turnstileVerified = ref(false)
  let widgetId: string | null = null
  let widgetRun = 0
  let configRun = 0

  const removeTurnstile = (containerSelector: string) => {
    widgetRun += 1
    if (window.turnstile && widgetId) {
      try { window.turnstile.remove(widgetId) } catch { /* The widget may already be gone. */ }
    }
    widgetId = null
    const container = document.querySelector<HTMLElement>(containerSelector)
    if (container) container.innerHTML = ''
  }

  const renderTurnstile = (containerSelector: string, siteKey: string, callbacks: TurnstileCallbacks = {}) => {
    if (!window.turnstile) return
    removeTurnstile(containerSelector)
    const currentRun = widgetRun
    widgetId = window.turnstile.render(containerSelector, {
      sitekey: siteKey,
      action: 'turnstile-spin-v1',
      callback: (token) => {
        if (currentRun !== widgetRun) return
        turnstileToken.value = token
        setTurnstileToken(token)
        callbacks.onSuccess?.(token)
      },
      'error-callback': () => {
        if (currentRun !== widgetRun) return
        turnstileToken.value = ''
        clearTurnstileToken()
        callbacks.onError?.()
      },
      'expired-callback': () => {
        if (currentRun !== widgetRun) return
        turnstileToken.value = ''
        clearTurnstileToken()
        callbacks.onExpired?.()
      },
    })
  }

  const resetTurnstile = (containerSelector: string) => {
    window.turnstile?.reset(widgetId || containerSelector)
  }

  const loadTurnstileConfig = async (
    apiIndex: number,
    _isMultipleMode?: boolean,
    loginError?: Ref<string>,
  ): Promise<boolean> => {
    const currentRun = ++configRun
    try {
      turnstileEnabled.value = false
      turnstileLoginEnabled.value = false
      turnstileSiteKey.value = ''
      clearTurnstileToken()
      turnstileToken.value = ''
      turnstileVerified.value = false
      if (loginError) loginError.value = ''
      removeTurnstile('#admin-turnstile-container')

      const result = await fetchTurnstileConfigByIndex(apiIndex)
      if (currentRun !== configRun) return false
      const config = result.data
      if (result.error || !config) {
        if (loginError) loginError.value = result.message || result.error || '安全验证配置加载失败'
        return false
      } else {
        turnstileEnabled.value = isTurnstileValueEnabled(config.turnstile_enabled)
        turnstileLoginEnabled.value = isTurnstileValueEnabled(config.turnstile_login_enabled)
        const required = turnstileEnabled.value || turnstileLoginEnabled.value
        turnstileSiteKey.value = required ? String(config.turnstile_site_key || '') : ''
        turnstileVerified.value = turnstileEnabled.value
          && (config.verified === true || hasSharedTurnstileVerified(apiIndex))

        if (turnstileSiteKey.value && required) {
          await loadTurnstileScript()
        }
      }
      turnstileToken.value = getTurnstileToken()
      return true
    } catch (error) {
      if (currentRun !== configRun) return false
      turnstileToken.value = getTurnstileToken()
      if (loginError) loginError.value = error instanceof Error ? error.message : '安全验证配置加载失败'
      console.error('Failed to load Turnstile config:', error)
      return false
    }
  }

  const clearTurnstile = () => {
    turnstileToken.value = ''
    clearTurnstileToken()
  }

  return {
    turnstileEnabled,
    turnstileLoginEnabled,
    turnstileSiteKey,
    turnstileToken,
    turnstileVerified,
    hasSharedTurnstileVerified,
    loadTurnstileConfig,
    renderTurnstile,
    resetTurnstile,
    removeTurnstile,
    clearTurnstile,
  }
}
