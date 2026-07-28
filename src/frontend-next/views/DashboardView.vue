<template>
  <div class="app-shell" :class="{ 'is-dark': isDark }">
    <main class="dashboard-main">
      <AppHeader subtitle="SERVER MONITOR" :is-dark="isDark" @toggle-theme="$emit('toggle-theme')">
        <a-select v-model:value="apiEndpoint" class="header-site-select" aria-label="监控站点">
          <a-select-option v-for="endpoint in apiEndpoints" :key="endpoint.value" :value="endpoint.value">{{ endpoint.label }}</a-select-option>
        </a-select>
        <a-button type="text" href="#/admin"><template #icon><SettingOutlined /></template>管理后台</a-button>
      </AppHeader>

      <div class="dashboard-content">
        <section class="summary-grid" aria-label="监控摘要">
          <a-card class="summary-card"><a-statistic title="服务器" :value="servers.length"><template #prefix><CloudServerOutlined class="stat-icon orange" /></template></a-statistic><div class="summary-foot"><span class="status-dot online" /> {{ onlineCount }} 台在线 · {{ offlineCount }} 台离线</div></a-card>
          <a-card class="summary-card"><a-statistic title="平均 CPU" :value="averageCpu" suffix="%"><template #prefix><LineChartOutlined class="stat-icon green" /></template></a-statistic><div class="summary-foot positive">所有在线节点</div></a-card>
          <a-card class="summary-card"><a-statistic title="下载速率" :value="3.84" :precision="2" suffix="MB/s"><template #prefix><DownloadOutlined class="stat-icon blue" /></template></a-statistic><div class="summary-foot muted">总计 18.42 TB</div></a-card>
          <a-card class="summary-card"><a-statistic title="上传速率" :value="1.27" :precision="2" suffix="MB/s"><template #prefix><UploadOutlined class="stat-icon yellow" /></template></a-statistic><div class="summary-foot muted">总计 7.96 TB</div></a-card>
        </section>

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

          <div v-if="filteredServers.length && view === 'bar'" class="server-grid">
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
              <template v-if="column.key === 'name'"><a :href="`#/server/${record.id}`" class="table-server-link"><img :src="`/flags/${record.region}.svg`" alt="" /><span><strong>{{ record.name }}</strong><small>{{ record.location }}</small></span></a></template>
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
import AEmpty from 'ant-design-vue/es/empty'
import AInput from 'ant-design-vue/es/input'
import AProgress from 'ant-design-vue/es/progress'
import { RadioButton as ARadioButton, RadioGroup as ARadioGroup } from 'ant-design-vue/es/radio'
import ASelect, { SelectOption as ASelectOption } from 'ant-design-vue/es/select'
import AStatistic from 'ant-design-vue/es/statistic'
import ATable from 'ant-design-vue/es/table'
import { AppstoreOutlined, CloudServerOutlined, DownloadOutlined, LineChartOutlined, PieChartOutlined, SearchOutlined, SettingOutlined, UnorderedListOutlined, UploadOutlined } from '@ant-design/icons-vue'

import AppHeader from '../components/AppHeader.vue'
import ServerCard from '../components/ServerCard.vue'
import { apiEndpoints } from '../data/admin'
import { dashboardServers } from '../data/dashboard'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const router = useRouter()
const toolbarRef = ref<HTMLElement | null>(null)
const isToolbarStacked = ref(false)
let toolbarResizeObserver: ResizeObserver | null = null
const view = ref<'bar' | 'ring' | 'table'>('bar')
const activeFilter = ref('all')
const query = ref('')
const apiEndpoint = ref(apiEndpoints[0]!.value)
const servers = dashboardServers

const onlineCount = computed(() => servers.filter((server) => server.status === 'online').length)
const offlineCount = computed(() => servers.length - onlineCount.value)
const averageCpu = computed(() => Math.round(servers.filter((server) => server.status === 'online').reduce((total, server) => total + server.cpu, 0) / onlineCount.value))
const filters = computed(() => [
  { label: '全部', value: 'all', count: servers.length },
  { label: '在线', value: 'online', count: onlineCount.value },
  { label: '离线', value: 'offline', count: offlineCount.value },
  { label: '美国', value: 'us', count: servers.filter((server) => server.region === 'us').length, flag: 'us' },
  { label: '日本', value: 'jp', count: servers.filter((server) => server.region === 'jp').length, flag: 'jp' },
  { label: '德国', value: 'de', count: servers.filter((server) => server.region === 'de').length, flag: 'de' },
  { label: '新加坡', value: 'sg', count: servers.filter((server) => server.region === 'sg').length, flag: 'sg' },
])

const filteredServers = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return servers.filter((server) => {
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
function openDetail(id: string) { void router.push(`/server/${id}`) }
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
  toolbarResizeObserver = new ResizeObserver(updateToolbarLayout)
  if (toolbarRef.value) toolbarResizeObserver.observe(toolbarRef.value)
  void document.fonts?.ready.then(updateToolbarLayout)
  window.requestAnimationFrame(updateToolbarLayout)
})

onUnmounted(() => toolbarResizeObserver?.disconnect())
</script>
