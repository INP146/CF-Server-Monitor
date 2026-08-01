<template>
  <a-config-provider :theme="themeConfig">
    <main v-if="accessState !== 'ready'" class="access-gate">
      <a-result v-if="accessState === 'error'" status="error" :title="t('verificationFailed')" :sub-title="accessError">
        <template #extra><a-button type="primary" @click="initializeAccess">{{ t('retry') }}</a-button></template>
      </a-result>
      <template v-else>
        <a-spin size="large" :tip="t('checkingAccess')" />
        <div id="global-turnstile-container" />
      </template>
    </main>
    <router-view v-else v-slot="{ Component }">
      <component :is="Component" :is-dark="isDark" @toggle-theme="toggleTheme" />
    </router-view>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AButton from 'ant-design-vue/es/button'
import AConfigProvider from 'ant-design-vue/es/config-provider'
import AResult from 'ant-design-vue/es/result'
import ASpin from 'ant-design-vue/es/spin'
import antTheme from 'ant-design-vue/es/theme'
import { useTheme } from './composables/useTheme'
import { http } from './utils/http'
import { TURNSTILE_EXPIRED_EVENT } from './utils/auth'
import { initLanguage, t } from './utils/i18n'
import {
  clearTurnstileToken,
  fetchAllTurnstileConfigs,
  getTurnstileEnabledSites,
  getNextTurnstileSite,
  loadTurnstileScript,
  setTurnstileToken,
} from './utils/turnstile'

const { resolvedTheme, toggleTheme } = useTheme()
const isDark = computed(() => resolvedTheme.value === 'dark')
const route = useRoute()
const accessState = ref<'loading' | 'ready' | 'error'>('loading')
const accessError = ref('')
let appMounted = false
let accessRun = 0
let accessWidgetId: string | null = null

function removeAccessWidget() {
  if (!accessWidgetId || !window.turnstile) return
  try { window.turnstile.remove(accessWidgetId) } catch { /* The widget may already be detached. */ }
  accessWidgetId = null
}

const themeConfig = computed(() => ({
  algorithm: isDark.value ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#f38020',
    colorLink: '#d96710',
    borderRadius: 6,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
}))

async function initializeAccess() {
  const currentRun = ++accessRun
  removeAccessWidget()
  accessState.value = 'loading'
  accessError.value = ''
  if (route.path.startsWith('/admin')) {
    accessState.value = 'ready'
    return
  }

  try {
    const results = await fetchAllTurnstileConfigs()
    const enabledSites = getTurnstileEnabledSites(results, 'global')
    if (currentRun !== accessRun) return
    if (!enabledSites.length || enabledSites.every((site) => site.verified)) {
      accessState.value = 'ready'
      return
    }
    const site = getNextTurnstileSite(enabledSites)
    if (!site) {
      accessState.value = 'ready'
      return
    }
    if (!site.siteKey) throw new Error(t('siteMissingTurnstileKey', { number: site.index + 1 }))
    await loadTurnstileScript()
    await nextTick()
    if (currentRun !== accessRun) return
    if (!window.turnstile) throw new Error(t('turnstileScriptFailed'))

    accessWidgetId = window.turnstile.render('#global-turnstile-container', {
      sitekey: site.siteKey,
      action: 'turnstile-spin-v1',
      callback: async (token) => {
        if (currentRun !== accessRun) return
        setTurnstileToken(token)
        const verification = await http.getByIndex<{ verified?: boolean }>('/api/config', site.index, {
          includeAuth: true,
          includeTurnstile: true,
          autoRedirect: false,
        })
        if (currentRun !== accessRun) return
        if (!verification.error && verification.data?.verified === true) void initializeAccess()
        else {
          clearTurnstileToken()
          accessError.value = verification.message || verification.error || t('redoVerification')
          accessState.value = 'error'
        }
      },
      'error-callback': () => {
        if (currentRun !== accessRun) return
        clearTurnstileToken()
        accessError.value = t('verificationComponentFailed')
        accessState.value = 'error'
      },
      'expired-callback': () => {
        if (currentRun !== accessRun) return
        clearTurnstileToken()
        accessError.value = t('verificationExpired')
        accessState.value = 'error'
      },
    })
  } catch (error) {
    if (currentRun !== accessRun) return
    accessError.value = error instanceof Error ? error.message : t('accessCheckFailed')
    accessState.value = 'error'
  }
}

const handleTurnstileExpired = () => {
  if (!route.path.startsWith('/admin')) void initializeAccess()
}

watch(() => route.path.startsWith('/admin'), () => {
  if (appMounted) void initializeAccess()
})
onMounted(() => {
  initLanguage()
  appMounted = true
  window.addEventListener(TURNSTILE_EXPIRED_EVENT, handleTurnstileExpired)
  void initializeAccess()
})
onBeforeUnmount(() => {
  appMounted = false
  removeAccessWidget()
  window.removeEventListener(TURNSTILE_EXPIRED_EVENT, handleTurnstileExpired)
})
</script>
