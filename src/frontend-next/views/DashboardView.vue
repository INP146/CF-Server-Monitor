<template>
  <div class="app-shell" :class="{ 'is-dark': isDark }">
    <main class="dashboard-main">
      <AppHeader :title="dashboard.sysConfig.value.site_title" subtitle="SERVER MONITOR" :is-dark="isDark" @toggle-theme="$emit('toggle-theme')">
        <a-select v-if="apiEndpoints.length > 1" v-model:value="apiEndpoint" class="header-site-select" :aria-label="t('monitoringSite')">
          <a-select-option v-for="endpoint in apiEndpoints" :key="endpoint.value" :value="endpoint.value">{{ endpoint.label }}</a-select-option>
        </a-select>
        <a-button type="text" :href="adminHref"><template #icon><SettingOutlined /></template>{{ t('admin') }}</a-button>
      </AppHeader>

      <div class="dashboard-content">
        <a-alert v-if="dashboard.error.value" type="error" show-icon :message="t('monitorLoadFailed')" :description="dashboard.error.value.message">
          <template #action><a-button size="small" :loading="dashboard.isLoading.value" @click="dashboard.refresh">{{ t('retry') }}</a-button></template>
        </a-alert>
        <a-alert v-else-if="dashboard.corsErrorSites.value.length" type="warning" show-icon :message="t('partialSitesFailed')" :description="dashboard.corsErrorSites.value.join('、')">
          <template #action><a-button size="small" :loading="dashboard.sitesRemaining.value > 0" @click="dashboard.refresh">{{ t('retry') }}</a-button></template>
        </a-alert>
        <FleetSummary
          :total="servers.length"
          :online="onlineCount"
          :offline="offlineCount"
          :average-cpu="averageCpu"
          :download-rate="downloadRate"
          :download-total="downloadTotal"
          :upload-rate="uploadRate"
          :upload-total="uploadTotal"
        />

        <section class="fleet-section">
          <div ref="toolbarRef" class="fleet-toolbar fleet-toolbar-primary" :class="{ 'is-stacked': isToolbarStacked }">
            <a-radio-group v-model:value="activeFilter" button-style="solid" class="filter-group">
              <a-radio-button v-for="filter in filters" :key="filter.value" :value="filter.value">
                <span class="filter-label"><span v-if="filter.value === 'online'" class="status-dot online" /><span v-else-if="filter.value === 'offline'" class="status-dot offline" /><img v-else-if="filter.flag" :src="`/flags/${filter.flag}.svg`" alt="" />{{ filter.label }}<small>{{ filter.count }}</small></span>
              </a-radio-button>
            </a-radio-group>
            <div class="toolbar-controls">
              <a-input v-model:value="query" allow-clear :placeholder="t('searchDashboard')" class="search-input"><template #prefix><SearchOutlined /></template></a-input>
              <a-radio-group v-model:value="view" button-style="solid" class="view-switcher" :aria-label="t('displayMode')">
                <a-radio-button value="bar"><a-tooltip :title="t('cardView')"><AppstoreOutlined /></a-tooltip></a-radio-button>
                <a-radio-button value="ring"><a-tooltip :title="t('ringView')"><PieChartOutlined /></a-tooltip></a-radio-button>
                <a-radio-button value="table"><a-tooltip :title="t('tableView')"><UnorderedListOutlined /></a-tooltip></a-radio-button>
                <a-radio-button value="map"><a-tooltip :title="t('mapView')"><EnvironmentOutlined /></a-tooltip></a-radio-button>
              </a-radio-group>
            </div>
          </div>

          <div v-if="dashboard.isLoading.value" class="dashboard-loading" role="status" aria-live="polite">
            <a-spin :tip="t('loadingMonitor')" />
          </div>

          <template v-else-if="filteredServers.length && view === 'bar'">
            <section v-for="group in groupedFilteredServers" :key="group.name" class="server-group-section">
              <h2 class="server-group-heading">{{ group.name }} <small>{{ group.servers.length }}</small></h2>
              <div class="server-grid">
                <ServerCard v-for="server in group.servers" :key="`${server.apiIndex || 0}-${server.id}`" :server="server" :config="serverConfig(server)" />
              </div>
            </section>
          </template>

          <template v-else-if="filteredServers.length && view === 'ring'">
            <section v-for="group in groupedFilteredServers" :key="group.name" class="server-group-section">
              <h2 class="server-group-heading">{{ group.name }} <small>{{ group.servers.length }}</small></h2>
              <div class="ring-server-grid">
                <a-card v-for="server in group.servers" :key="`${server.apiIndex || 0}-${server.id}`" class="ring-server-card" hoverable @click="openDetail(server)">
                  <div class="ring-card-head"><span><img :src="`/flags/${server.region}.svg`" alt="" /><strong>{{ server.name }}</strong></span><a-badge :status="server.status === 'online' ? 'success' : 'error'" /></div>
                  <div v-if="ringMeta(server).length" class="ring-card-meta"><span v-for="item in ringMeta(server)" :key="item">{{ item }}</span></div>
                  <div class="ring-metrics">
                    <div><a-progress type="circle" :size="84" :percent="server.cpu" :stroke-color="metricColor(server.cpu)" /><span>CPU</span></div>
                    <div><a-progress type="circle" :size="84" :percent="server.memory" :stroke-color="metricColor(server.memory)" /><span>{{ t('memory') }}</span></div>
                    <div><a-progress type="circle" :size="84" :percent="server.disk" :stroke-color="metricColor(server.disk)" /><span>{{ t('disk') }}</span></div>
                  </div>
                  <div class="ring-card-foot"><span>{{ server.location }}</span></div>
                  <div v-if="serverConfig(server).show_tf || serverConfig(server).show_time" class="ring-card-status">
                    <span v-if="serverConfig(server).show_tf">{{ t('monthlyTraffic') }} {{ server.trafficUsed }} / {{ server.trafficLimitText === '不限' ? t('unlimited') : server.trafficLimitText }}</span>
                    <span v-if="serverConfig(server).show_time">{{ server.dataTime }}</span>
                  </div>
                </a-card>
              </div>
            </section>
          </template>

          <DashboardMap v-else-if="filteredServers.length && view === 'map'" :regions="mapRegions" :is-dark="isDark" />

          <a-table v-else-if="filteredServers.length && view === 'table'" class="dashboard-table" :columns="tableColumns" :data-source="filteredServers" :row-key="tableRowKey" :pagination="false" :scroll="{ x: 980 }" size="middle">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'"><a :href="detailHref(record)" class="table-server-link"><img :src="`/flags/${record.region}.svg`" alt="" /><span><strong>{{ record.name }}</strong><small>{{ record.location }}</small></span></a></template>
              <template v-else-if="column.key === 'usage'"><div class="table-usage"><span>CPU {{ record.cpu }}%</span><span>{{ t('memory') }} {{ record.memory }}%</span><span>{{ t('disk') }} {{ record.disk }}%</span></div></template>
              <template v-else-if="column.key === 'network'"><span class="mono-text">↓ {{ record.download }} · ↑ {{ record.upload }}</span></template>
              <template v-else-if="column.key === 'billing'"><span class="table-meta-stack"><span v-if="serverConfig(record).show_price">{{ record.priceText || '-' }}</span><small v-if="serverConfig(record).show_expire">{{ record.expireDate || t('noExpiry') }}</small></span></template>
              <template v-else-if="column.key === 'traffic'"><span v-if="serverConfig(record).show_tf" class="table-meta-stack"><span>{{ record.trafficUsed }}</span><small>{{ record.trafficLimitText }}</small></span></template>
              <template v-else-if="column.key === 'updated'"><span v-if="serverConfig(record).show_time">{{ record.dataTime }}</span></template>
              <template v-else-if="column.key === 'status'"><a-badge :status="record.status === 'online' ? 'success' : 'error'" :text="record.status === 'online' ? t('online') : t('offline')" /></template>
            </template>
          </a-table>

          <a-empty v-else :description="emptyDescription" class="empty-result"><a-button v-if="hasActiveFilters" size="small" @click="clearFilters">{{ t('clearFilters') }}</a-button></a-empty>
        </section>
      </div>
    </main>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AButton from 'ant-design-vue/es/button'
import ABadge from 'ant-design-vue/es/badge'
import ACard from 'ant-design-vue/es/card'
import AAlert from 'ant-design-vue/es/alert'
import AEmpty from 'ant-design-vue/es/empty'
import AInput from 'ant-design-vue/es/input'
import AProgress from 'ant-design-vue/es/progress'
import { RadioButton as ARadioButton, RadioGroup as ARadioGroup } from 'ant-design-vue/es/radio'
import ASelect, { SelectOption as ASelectOption } from 'ant-design-vue/es/select'
import ASpin from 'ant-design-vue/es/spin'
import ATable from 'ant-design-vue/es/table'
import { AppstoreOutlined, EnvironmentOutlined, PieChartOutlined, SearchOutlined, SettingOutlined, UnorderedListOutlined } from '@ant-design/icons-vue'

import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'
import DashboardMap from '../components/DashboardMap.vue'
import FleetSummary from '../components/FleetSummary.vue'
import ServerCard from '../components/ServerCard.vue'
import { useDashboard } from '../composables/useDashboard'
import type { MockServer } from '../data/dashboard'
import type { DashboardView } from '../types/dashboard'
import { formatBytes, isServerOnline } from '../utils/format'
import { getApiBases } from '../utils/config'
import { toDisplayServer } from '../utils/view-model'
import { currentLanguage, t } from '../utils/i18n'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const router = useRouter()
const dashboard = useDashboard()
const toolbarRef = ref<HTMLElement | null>(null)
const isToolbarStacked = ref(false)
let toolbarResizeObserver: ResizeObserver | null = null
const view = computed<DashboardView>({
  get: () => dashboard.currentView.value,
  set: (value) => dashboard.switchView(value),
})
const activeFilter = ref('all')
const query = ref('')
const bases = getApiBases()
const apiEndpoints = computed(() => [
  ...(bases.length > 1 ? [{ label: t('allSites'), value: 'all' }] : []),
  ...bases.map((value, index) => ({ label: bases.length > 1 ? t('siteNumber', { number: index + 1 }) : t('currentSite'), value })),
])
const apiEndpoint = ref(bases.length > 1 ? 'all' : bases[0]!)
const selectedApiIndex = computed(() => Math.max(0, bases.indexOf(apiEndpoint.value)))
const adminHref = computed(() => `#/admin?api=${apiEndpoint.value === 'all' ? 0 : selectedApiIndex.value}`)
const servers = computed(() => dashboard.servers.value
  .filter((server) => apiEndpoint.value === 'all' || !server.source || server.source === apiEndpoint.value)
  .map((server) => toDisplayServer(server, dashboard.now.value, server.source ? Math.max(0, bases.indexOf(server.source)) : 0, currentLanguage.value)))

const onlineCount = computed(() => servers.value.filter((server) => server.status === 'online').length)
const offlineCount = computed(() => servers.value.length - onlineCount.value)
const averageCpu = computed(() => Math.round(servers.value.filter((server) => server.status === 'online').reduce((total, server) => total + server.cpu, 0) / Math.max(onlineCount.value, 1)))
const scopedRawServers = computed(() => dashboard.servers.value.filter((server) => apiEndpoint.value === 'all' || !server.source || server.source === apiEndpoint.value))
const onlineRawServers = computed(() => scopedRawServers.value.filter((server) => isServerOnline(server, dashboard.now.value)))
const downloadRate = computed(() => onlineRawServers.value.reduce((total, server) => total + Number(server.net_in_speed || 0), 0) / 1024 ** 2)
const uploadRate = computed(() => onlineRawServers.value.reduce((total, server) => total + Number(server.net_out_speed || 0), 0) / 1024 ** 2)
const downloadTotal = computed(() => formatBytes(scopedRawServers.value.reduce((total, server) => total + Number(server.net_rx || 0), 0)))
const uploadTotal = computed(() => formatBytes(scopedRawServers.value.reduce((total, server) => total + Number(server.net_tx || 0), 0)))
const filters = computed<Array<{ label: string; value: string; count: number; flag?: string }>>(() => [
  { label: t('all'), value: 'all', count: servers.value.length },
  { label: t('online'), value: 'online', count: onlineCount.value },
  { label: t('offline'), value: 'offline', count: offlineCount.value },
  ...Object.entries(servers.value.reduce<Record<string, number>>((counts, server) => {
    counts[server.region] = (counts[server.region] || 0) + 1
    return counts
  }, {})).map(([region, count]) => ({ label: region.toUpperCase(), value: region, count, flag: region })),
])

const filteredServers = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return servers.value.filter((server) => {
    const filterMatches = activeFilter.value === 'all' || server.status === activeFilter.value || server.region === activeFilter.value
    const queryMatches = !normalizedQuery || `${server.name} ${server.location} ${server.ip} ${server.os} ${server.tags.join(' ')}`.toLowerCase().includes(normalizedQuery)
    return filterMatches && queryMatches
  })
})
const hasActiveFilters = computed(() => activeFilter.value !== 'all' || Boolean(query.value.trim()))
const emptyDescription = computed(() => dashboard.error.value
  ? t('monitorUnavailable')
  : servers.value.length ? t('noMatchingNodes') : t('noNodes'))

const groupedFilteredServers = computed(() => {
  const groups = new Map<string, MockServer[]>()
  for (const server of filteredServers.value) {
    const name = server.group || 'Default'
    const values = groups.get(name) || []
    values.push(server)
    groups.set(name, values)
  }
  return Array.from(groups, ([name, groupServers]) => ({ name, servers: groupServers }))
})
const mapRegions = computed(() => filteredServers.value.reduce<Record<string, number>>((regions, server) => {
  regions[server.region] = (regions[server.region] || 0) + 1
  return regions
}, {}))

type DisplaySetting = 'show_price' | 'show_expire' | 'show_tf' | 'show_time'
function serverConfig(server: Pick<MockServer, 'apiIndex'>) {
  const baseUrl = bases[server.apiIndex ?? 0]
  return baseUrl ? dashboard.siteConfigs.value[baseUrl] ?? dashboard.sysConfig.value : dashboard.sysConfig.value
}
function hasVisibleSetting(setting: DisplaySetting) {
  if (filteredServers.value.length) return filteredServers.value.some((server) => serverConfig(server)[setting])
  if (apiEndpoint.value !== 'all') return (dashboard.siteConfigs.value[apiEndpoint.value] ?? dashboard.sysConfig.value)[setting]
  return dashboard.sysConfig.value[setting]
}

const tableColumns = computed(() => [
  { title: t('node'), key: 'name', width: 220 },
  { title: t('resourceUsage'), key: 'usage', width: 260 },
  { title: t('realtimeNetwork'), key: 'network', width: 210 },
  ...((hasVisibleSetting('show_price') || hasVisibleSetting('show_expire'))
    ? [{ title: t('billingExpiry'), key: 'billing', width: 150 }]
    : []),
  ...(hasVisibleSetting('show_tf') ? [{ title: t('monthlyTraffic'), key: 'traffic', width: 140 }] : []),
  ...(hasVisibleSetting('show_time') ? [{ title: t('dataTime'), key: 'updated', width: 180 }] : []),
  { title: t('status'), key: 'status', width: 90 },
])

function clearFilters() { activeFilter.value = 'all'; query.value = '' }
function openDetail(server: MockServer) {
  void router.push({ path: `/server/${server.id}`, query: server.apiIndex ? { api: server.apiIndex } : {} })
}
function detailHref(value: Record<string, unknown>) {
  const id = encodeURIComponent(String(value.id || ''))
  const index = Number(value.apiIndex) || 0
  return `#/server/${id}${index ? `?api=${index}` : ''}`
}
function metricColor(value: number) { return value >= 85 ? '#dc2626' : value >= 65 ? '#d48806' : '#16a34a' }
function tableRowKey(server: MockServer) { return `${server.apiIndex || 0}-${server.id}` }
function ringMeta(server: MockServer) {
  const config = serverConfig(server)
  return [
    config.show_price ? server.priceText : '',
    config.show_expire && server.expireDate ? `${t('expiry')} ${server.expireDate}` : '',
  ].filter(Boolean)
}

function updateToolbarLayout() {
  const toolbar = toolbarRef.value
  const buttons = toolbar?.querySelectorAll<HTMLElement>('.filter-group .ant-radio-button-wrapper')
  const controls = toolbar?.querySelector<HTMLElement>('.toolbar-controls')
  if (!toolbar || !buttons?.length) return
  const filterContentWidth = [...buttons].reduce((width, button) => width + button.getBoundingClientRect().width, 0) - buttons.length + 1
  const requiredWidth = Math.ceil(filterContentWidth + (controls?.getBoundingClientRect().width || 0) + 16)
  isToolbarStacked.value = window.matchMedia('(max-width: 640px)').matches
    || toolbar.clientWidth < requiredWidth
}

onMounted(() => {
  void dashboard.initialize()
  toolbarResizeObserver = new ResizeObserver(updateToolbarLayout)
  if (toolbarRef.value) toolbarResizeObserver.observe(toolbarRef.value)
  void document.fonts?.ready.then(updateToolbarLayout)
  window.requestAnimationFrame(updateToolbarLayout)
})

onUnmounted(() => toolbarResizeObserver?.disconnect())
</script>
