<template>
  <footer class="app-footer">
    <a-tooltip :title="hasUpdate ? t('workersUpdate', { version: latestVersion }) : ''">
      <span class="app-version" :class="{ 'has-update': hasUpdate }">
        {{ t('workersCurrent', { version: currentVersion || '-' }) }}
        <span v-if="hasUpdate" class="version-update-dot" />
      </span>
    </a-tooltip>
    <a href="https://github.com/INP146/EdgeProbe" target="_blank" rel="noreferrer">{{ t('poweredBy') }}</a>
  </footer>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import ATooltip from 'ant-design-vue/es/tooltip'

import { fetchConfig, LAST_WORKERS_VERSION, VERSION } from '../utils/api'
import { normalizeApiIndex } from '../utils/auth'
import { t } from '../utils/i18n'

const currentVersion = computed(() => String(VERSION.value || '').trim())
const latestVersion = computed(() => String(LAST_WORKERS_VERSION.value || '').trim())
const hasUpdate = computed(() => Boolean(currentVersion.value && latestVersion.value && currentVersion.value !== latestVersion.value))
const route = useRoute()
const refreshVersion = () => { void fetchConfig(normalizeApiIndex(route.query.api ?? route.query.apiIndex)) }
watch(() => [route.query.api, route.query.apiIndex], refreshVersion)
onMounted(refreshVersion)
</script>
