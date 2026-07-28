<template>
  <a-config-provider :theme="themeConfig">
    <main v-if="accessState !== 'ready'" class="access-gate">
      <a-result v-if="accessState === 'error'" status="error" title="安全验证失败" :sub-title="accessError">
        <template #extra><a-button type="primary" @click="initializeAccess">重试</a-button></template>
      </a-result>
      <template v-else>
        <a-spin size="large" tip="正在检查访问权限" />
        <div id="global-turnstile-container" />
      </template>
    </main>
    <router-view v-else v-slot="{ Component }">
      <component :is="Component" :is-dark="isDark" @toggle-theme="toggleTheme" />
    </router-view>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AButton from 'ant-design-vue/es/button'
import AConfigProvider from 'ant-design-vue/es/config-provider'
import AResult from 'ant-design-vue/es/result'
import ASpin from 'ant-design-vue/es/spin'
import antTheme from 'ant-design-vue/es/theme'
import { http } from './utils/http'
import {
  clearTurnstileToken,
  fetchAllTurnstileConfigs,
  getTurnstileEnabledSites,
  hasTurnstileSiteKeyMismatch,
  loadTurnstileScript,
  setTurnstileToken,
} from './utils/turnstile'

const isDark = ref(window.localStorage.getItem('edgeprobe-theme') === 'dark')
const route = useRoute()
const accessState = ref<'loading' | 'ready' | 'error'>('loading')
const accessError = ref('')

function toggleTheme() {
  isDark.value = !isDark.value
}

watch(isDark, (value) => {
  window.localStorage.setItem('edgeprobe-theme', value ? 'dark' : 'light')
})

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
  accessState.value = 'loading'
  accessError.value = ''
  if (route.path.startsWith('/admin')) {
    accessState.value = 'ready'
    return
  }

  try {
    const results = await fetchAllTurnstileConfigs()
    const enabledSites = getTurnstileEnabledSites(results, 'global')
    if (!enabledSites.length || enabledSites.every((site) => site.verified)) {
      accessState.value = 'ready'
      return
    }
    if (hasTurnstileSiteKeyMismatch(enabledSites)) {
      throw new Error('多个监控站点的 Turnstile Site Key 不一致')
    }

    const site = enabledSites[0]!
    await loadTurnstileScript()
    await nextTick()
    if (!window.turnstile) throw new Error('Turnstile 脚本加载失败')

    window.turnstile.render('#global-turnstile-container', {
      sitekey: site.siteKey,
      callback: async (token) => {
        setTurnstileToken(token)
        const verification = await http.getByIndex<{ verified?: boolean }>('/api/config', site.index, {
          includeAuth: true,
          includeTurnstile: true,
          autoRedirect: false,
        })
        if (!verification.error && verification.data?.verified === true) accessState.value = 'ready'
        else {
          clearTurnstileToken()
          accessError.value = verification.message || verification.error || '请重新完成安全验证'
          accessState.value = 'error'
        }
      },
      errorCallback: () => {
        clearTurnstileToken()
        accessError.value = '安全验证组件加载失败'
        accessState.value = 'error'
      },
      expiredCallback: clearTurnstileToken,
    })
  } catch (error) {
    accessError.value = error instanceof Error ? error.message : '访问权限检查失败'
    accessState.value = 'error'
  }
}

onMounted(() => { void initializeAccess() })
</script>
