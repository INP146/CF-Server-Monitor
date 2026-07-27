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

  const removeTurnstile = (containerSelector: string) => {
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
    widgetId = window.turnstile.render(containerSelector, {
      sitekey: siteKey,
      callback: (token) => {
        turnstileToken.value = token
        setTurnstileToken(token)
        callbacks.onSuccess?.(token)
      },
      errorCallback: () => {
        turnstileToken.value = ''
        clearTurnstileToken()
        callbacks.onError?.()
      },
      expiredCallback: () => {
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
  ) => {
    try {
      turnstileEnabled.value = false
      turnstileLoginEnabled.value = false
      turnstileSiteKey.value = ''
      turnstileToken.value = getTurnstileToken()
      turnstileVerified.value = false
      if (loginError) loginError.value = ''
      removeTurnstile('#admin-turnstile-container')

      const result = await fetchTurnstileConfigByIndex(apiIndex)
      const config = result.data
      if (!result.error && config) {
        turnstileEnabled.value = isTurnstileValueEnabled(config.turnstile_enabled)
        turnstileLoginEnabled.value = isTurnstileValueEnabled(config.turnstile_login_enabled)
        const required = turnstileEnabled.value || turnstileLoginEnabled.value
        turnstileSiteKey.value = required ? String(config.turnstile_site_key || '') : ''
        turnstileVerified.value = turnstileEnabled.value
          && (config.verified === true || hasSharedTurnstileVerified())

        if (turnstileSiteKey.value
          && (turnstileLoginEnabled.value || (turnstileEnabled.value && !turnstileVerified.value))) {
          await loadTurnstileScript()
        }
      }
      turnstileToken.value = getTurnstileToken()
    } catch (error) {
      turnstileToken.value = getTurnstileToken()
      console.error('Failed to load Turnstile config:', error)
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
