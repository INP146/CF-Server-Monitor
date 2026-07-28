<template>
  <div class="app-shell" :class="{ 'is-dark': isDark }">
    <main class="dashboard-main">
      <AppHeader subtitle="SERVER MONITOR" :is-dark="isDark" @toggle-theme="$emit('toggle-theme')">
        <a-select v-if="apiEndpoints.length > 1" v-model:value="apiEndpoint" class="header-site-select" aria-label="监控站点">
          <a-select-option v-for="endpoint in apiEndpoints" :key="endpoint.value" :value="endpoint.value">{{ endpoint.label }}</a-select-option>
        </a-select>
        <a-button type="text" href="#/admin"><template #icon><SettingOutlined /></template>管理后台</a-button>
      </AppHeader>

      <div class="dashboard-content">
        <a-alert v-if="dashboard.error.value" type="error" show-icon message="监控数据加载失败" :description="dashboard.error.value.message" />
        <a-alert v-else-if="dashboard.corsErrorSites.value.length" type="warning" show-icon message="部分站点无法访问" :description="dashboard.corsErrorSites.value.join('、')" />
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
              <a-input v-model:value="query" allow-clear placeholder="搜索名称、地址、系统或标签" class="search-input"><template #prefix><SearchOutlined /></template></a-input>
              <a-radio-group v-model:value="view" button-style="solid" class="view-switcher" aria-label="展示模式">
                <a-radio-button value="bar"><a-tooltip title="卡片视图"><AppstoreOutlined /></a-tooltip></a-radio-button>
                <a-radio-button value="ring"><a-tooltip title="环形视图"><PieChartOutlined /></a-tooltip></a-radio-button>
                <a-radio-button value="table"><a-tooltip title="表格视图"><UnorderedListOutlined /></a-tooltip></a-radio-button>
              </a-radio-group>
            </div>
          </div>

          <div v-if="dashboard.isLoading.value" class="empty-result"><a-spin tip="正在加载监控数据" /></div>

          <div v-else-if="filteredServers.length && view === 'bar'" class="server-grid">
            <ServerCard v-for="server in filteredServers" :key="server.id" :server="server" />
          </div>

          <div v-else-if="filteredServers.length && view === 'ring'" class="ring-server-grid">
            <a-card v-for="server in filteredServers" :key="server.id" class="ring-server-card" hoverable @click="openDetail(server.id)">
              <div class="ring-card-head"><span><img :src="`/flags/${server.region}.svg`" alt="" /><strong>{{ server.name }}</strong></span><a-badge :status="server.status === 'online' ? 'success' : 'error'" /></div>
              <div class="ring-metrics">
                <div><a-progress type="circle" :size="84" :percent="server.cpu" :stroke-color="metricColor(server.cpu)" /><span>CPU</span></div>
                <div><a-progress type="circle" :size="84" :percent="server.memory" :stroke-color="metricColor(server.memory)" /><span>内存</span></div>
                <div><a-progress type="circle" :size="84" :percent="server.disk" :stroke-color="metricColor(server.disk)" /><span>磁盘</span></div>
              </div>
              <div class="ring-card-foot"><span>{{ server.location }}</span><span>{{ server.latency === null ? '超时' : `${server.latency} ms` }}</span></div>
            </a-card>
          </div>

          <a-table v-else-if="filteredServers.length" class="dashboard-table" :columns="tableColumns" :data-source="filteredServers" row-key="id" :pagination="false" :scroll="{ x: 820 }" size="middle">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'"><a :href="detailHref(record)" class="table-server-link"><img :src="`/flags/${record.region}.svg`" alt="" /><span><strong>{{ record.name }}</strong><small>{{ record.location }}</small></span></a></template>
              <template v-else-if="column.key === 'usage'"><div class="table-usage"><span>CPU {{ record.cpu }}%</span><span>内存 {{ record.memory }}%</span><span>磁盘 {{ record.disk }}%</span></div></template>
              <template v-else-if="column.key === 'network'"><span class="mono-text">↓ {{ record.download }} · ↑ {{ record.upload }}</span></template>
              <template v-else-if="column.key === 'latency'">{{ record.latency === null ? '超时' : `${record.latency} ms` }}</template>
              <template v-else-if="column.key === 'status'"><a-badge :status="record.status === 'online' ? 'success' : 'error'" :text="record.status === 'online' ? '在线' : '离线'" /></template>
            </template>
          </a-table>

          <a-empty v-else description="没有符合条件的节点" class="empty-result"><a-button size="small" @click="clearFilters">清除筛选</a-button></a-empty>
        </section>
      </div>
    </main>
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
import { AppstoreOutlined, PieChartOutlined, SearchOutlined, SettingOutlined, UnorderedListOutlined } from '@ant-design/icons-vue'

import AppHeader from '../components/AppHeader.vue'
import FleetSummary from '../components/FleetSummary.vue'
import ServerCard from '../components/ServerCard.vue'
import { useDashboard } from '../composables/useDashboard'
import { formatBytes } from '../utils/format'
import { getApiBases } from '../utils/config'
import { toDisplayServer } from '../utils/view-model'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const router = useRouter()
const dashboard = useDashboard()
const toolbarRef = ref<HTMLElement | null>(null)
const isToolbarStacked = ref(false)
let toolbarResizeObserver: ResizeObserver | null = null
const view = computed<'bar' | 'ring' | 'table'>({
  get: () => dashboard.currentView.value === 'map' ? 'bar' : dashboard.currentView.value,
  set: (value) => dashboard.switchView(value),
})
const activeFilter = ref('all')
const query = ref('')
const bases = getApiBases()
const apiEndpoints = [
  ...(bases.length > 1 ? [{ label: '全部站点', value: 'all' }] : []),
  ...bases.map((value, index) => ({ label: bases.length > 1 ? `站点 ${index + 1}` : '当前站点', value })),
]
const apiEndpoint = ref(bases.length > 1 ? 'all' : bases[0]!)
const servers = computed(() => dashboard.servers.value
  .filter((server) => apiEndpoint.value === 'all' || !server.source || server.source === apiEndpoint.value)
  .map((server) => toDisplayServer(server, dashboard.now.value, server.source ? bases.indexOf(server.source) : 0)))

const onlineCount = computed(() => servers.value.filter((server) => server.status === 'online').length)
const offlineCount = computed(() => servers.value.length - onlineCount.value)
const averageCpu = computed(() => Math.round(servers.value.filter((server) => server.status === 'online').reduce((total, server) => total + server.cpu, 0) / Math.max(onlineCount.value, 1)))
const scopedRawServers = computed(() => dashboard.servers.value.filter((server) => apiEndpoint.value === 'all' || !server.source || server.source === apiEndpoint.value))
const downloadRate = computed(() => scopedRawServers.value.reduce((total, server) => total + Number(server.net_in_speed || 0), 0) / 1024 ** 2)
const uploadRate = computed(() => scopedRawServers.value.reduce((total, server) => total + Number(server.net_out_speed || 0), 0) / 1024 ** 2)
const downloadTotal = computed(() => formatBytes(scopedRawServers.value.reduce((total, server) => total + Number(server.net_rx || 0), 0)))
const uploadTotal = computed(() => formatBytes(scopedRawServers.value.reduce((total, server) => total + Number(server.net_tx || 0), 0)))
const filters = computed<Array<{ label: string; value: string; count: number; flag?: string }>>(() => [
  { label: '全部', value: 'all', count: servers.value.length },
  { label: '在线', value: 'online', count: onlineCount.value },
  { label: '离线', value: 'offline', count: offlineCount.value },
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

const tableColumns = [
  { title: '节点', key: 'name', width: 220 },
  { title: '资源使用率', key: 'usage', width: 260 },
  { title: '实时网络', key: 'network', width: 210 },
  { title: '延迟', key: 'latency', width: 90 },
  { title: '状态', key: 'status', width: 90 },
]

function clearFilters() { activeFilter.value = 'all'; query.value = '' }
function openDetail(id: string) {
  const server = servers.value.find((item) => item.id === id)
  void router.push({ path: `/server/${id}`, query: server?.apiIndex ? { api: server.apiIndex } : {} })
}
function detailHref(value: Record<string, unknown>) {
  const id = encodeURIComponent(String(value.id || ''))
  const index = Number(value.apiIndex) || 0
  return `#/server/${id}${index ? `?api=${index}` : ''}`
}
function metricColor(value: number) { return value >= 85 ? '#dc2626' : value >= 65 ? '#d48806' : '#16a34a' }

function updateToolbarLayout() {
  const toolbar = toolbarRef.value
  const buttons = toolbar?.querySelectorAll<HTMLElement>('.filter-group .ant-radio-button-wrapper')
  if (!toolbar || !buttons?.length) return
  const filterContentWidth = [...buttons].reduce((width, button) => width + button.getBoundingClientRect().width, 0) - buttons.length + 1
  isToolbarStacked.value = window.matchMedia('(max-width: 640px)').matches
    || toolbar.clientWidth <= Math.ceil(filterContentWidth)
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
