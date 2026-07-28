<template>
  <div class="detail-page" :class="{ 'is-dark': isDark }">
    <AppHeader subtitle="SERVER DETAILS" :is-dark="isDark" @toggle-theme="$emit('toggle-theme')">
      <a-button type="text" href="#/"><template #icon><ArrowLeftOutlined /></template>返回监控页</a-button>
      <a-button type="text" href="#/admin"><template #icon><SettingOutlined /></template>管理后台</a-button>
    </AppHeader>

    <main v-if="loading && !server" class="detail-content detail-empty"><a-spin tip="正在加载节点数据" /></main>

    <main v-else-if="server" class="detail-content">
      <section class="detail-title-row">
        <div>
          <div class="detail-title-line">
            <h1>{{ server.name }}</h1>
            <a-badge :status="server.status === 'online' ? 'success' : 'error'" :text="server.status === 'online' ? '在线' : '离线'" />
          </div>
          <p>{{ server.location }} · {{ server.ip }} · {{ server.os }} {{ server.arch }}</p>
        </div>
        <a-radio-group :value="currentHours" button-style="solid" class="history-range" aria-label="历史时间范围" @change="selectRange($event.target.value)">
          <a-radio-button v-for="option in timeOptions" :key="option.value" :value="option.value">{{ option.label }}</a-radio-button>
        </a-radio-group>
      </section>

      <section class="detail-summary-grid" aria-label="节点摘要">
        <a-card v-for="item in summaryItems" :key="item.label" :class="['detail-summary-card', `tone-${item.tone}`]" size="small">
          <div class="detail-summary-label">
            <span class="detail-metric-icon" aria-hidden="true"><component :is="item.icon" /></span>
            <span>{{ item.label }}</span>
          </div>
          <strong :class="item.className">{{ item.value }}</strong>
        </a-card>
      </section>

      <section class="system-band">
        <div v-for="item in systemItems" :key="item.label" class="system-item">
          <span class="system-item-icon" aria-hidden="true"><component :is="item.icon" /></span>
          <div class="system-item-copy">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </section>

      <section class="chart-grid">
        <a-card v-for="metric in chartMetrics" :key="metric.key" class="chart-card" size="small">
          <template #title>
            <div class="chart-title-row">
              <span>{{ metric.title }}</span>
              <strong :style="{ color: metric.color }">{{ metric.current }}</strong>
            </div>
          </template>
          <MetricChart :title="metric.title" :series="metric.series" :unit="metric.unit" />
          <div class="chart-axis"><span>{{ rangeStartLabel }}</span><span>现在</span></div>
        </a-card>
      </section>
      <a-alert v-if="historyError" type="error" show-icon :message="historyError" />
    </main>

    <main v-else class="detail-content detail-empty">
      <a-result status="404" title="找不到节点" :sub-title="detailError || '该节点不存在或已经删除'">
        <template #extra><a-button type="primary" href="#/">返回监控页</a-button></template>
      </a-result>
    </main>

    <a-modal v-model:open="loginModalOpen" title="需要管理员登录" :footer="null">
      <p>查看 1 小时以上的历史记录需要管理员权限。</p>
      <a-button type="primary" block :href="`#/admin?redirect=/server/${route.params.id}`">前往登录</a-button>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AButton from 'ant-design-vue/es/button'
import AAlert from 'ant-design-vue/es/alert'
import ABadge from 'ant-design-vue/es/badge'
import ACard from 'ant-design-vue/es/card'
import AModal from 'ant-design-vue/es/modal'
import AResult from 'ant-design-vue/es/result'
import ASpin from 'ant-design-vue/es/spin'
import { RadioButton as ARadioButton, RadioGroup as ARadioGroup } from 'ant-design-vue/es/radio'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CloudDownloadOutlined,
  CodeOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  FieldTimeOutlined,
  HddOutlined,
  LineChartOutlined,
  PieChartOutlined,
  PoweroffOutlined,
  SettingOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  WifiOutlined,
} from '@ant-design/icons-vue'

import AppHeader from '../components/AppHeader.vue'
import MetricChart from '../components/MetricChart.vue'
import type { MockServer } from '../data/dashboard'
import type { DashboardServer, HistoryRecord } from '../types/dashboard'
import { ApiRequestError, fetchAllHistory, fetchServerDetail, isAdminLoggedIn } from '../utils/api'
import { formatBytes, toNumber } from '../utils/format'
import { formatDateTime, normalizeTimestamp } from '../utils/time'
import { historyLoad, historyNumbers, historyPercents, toDisplayServer } from '../utils/view-model'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const route = useRoute()
const currentHours = ref(1)
const loginModalOpen = ref(false)
const loading = ref(true)
const detailError = ref('')
const historyError = ref('')
const rawServer = ref<DashboardServer | null>(null)
const history = ref<HistoryRecord[]>([])
const apiIndex = computed(() => Math.max(0, Number(route.query.api) || 0))
const server = computed<MockServer | null>(() => rawServer.value ? toDisplayServer(rawServer.value, Date.now(), apiIndex.value) : null)

const timeOptions = [
  { label: '10m', value: 0.167 },
  { label: '30m', value: 0.5 },
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
  { label: '2d', value: 48 },
  { label: '7d', value: 168 },
]

const summaryItems = computed(() => {
  if (!server.value) return []
  return [
    { label: 'CPU 使用率', value: `${server.value.cpu}%`, className: '', icon: ThunderboltOutlined, tone: 'orange' },
    { label: '内存使用率', value: `${server.value.memory}%`, className: '', icon: DatabaseOutlined, tone: 'purple' },
    { label: '磁盘使用率', value: `${server.value.disk}%`, className: '', icon: PieChartOutlined, tone: 'teal' },
    { label: '网络延迟', value: server.value.latency === null ? '超时' : `${server.value.latency} ms`, className: server.value.latency === null ? 'metric-danger' : '', icon: WifiOutlined, tone: 'blue' },
  ]
})

const systemItems = computed(() => {
  if (!server.value || !rawServer.value) return []
  const raw = rawServer.value
  return [
    { label: '系统', value: `${server.value.os} / ${server.value.arch}`, icon: DesktopOutlined },
    { label: '内核', value: String(raw.kernel_version || '-'), icon: CodeOutlined },
    { label: 'CPU', value: `${String(raw.cpu_info || '-')} · ${toNumber(raw.cpu_cores as string | number | null | undefined)} 核`, icon: DashboardOutlined },
    { label: '内存 / 磁盘', value: `${formatBytes(raw.ram_total)} / ${formatBytes(raw.disk_total)}`, icon: HddOutlined },
    { label: '系统负载', value: server.value.load, icon: LineChartOutlined },
    { label: '运行时间', value: server.value.uptime, icon: FieldTimeOutlined },
    { label: '启动时间', value: formatDateTime(normalizeTimestamp(raw.boot_time as string | number | null | undefined)), icon: PoweroffOutlined },
    { label: '最后上报', value: formatDateTime(normalizeTimestamp(raw.last_updated)), icon: ClockCircleOutlined },
    { label: '总流量', value: `↓ ${formatBytes(raw.net_rx)} / ↑ ${formatBytes(raw.net_tx)}`, icon: CloudDownloadOutlined },
    { label: '实时网速', value: `↓ ${server.value.download} / ↑ ${server.value.upload}`, icon: SwapOutlined },
    { label: '本月流量', value: `↓ ${formatBytes(raw.net_rx_monthly)} / ↑ ${formatBytes(raw.net_tx_monthly)}`, icon: CalendarOutlined },
    { label: '月流量限额', value: toNumber(raw.traffic_limit) > 0 ? `${raw.traffic_limit} GB` : '不限', icon: DatabaseOutlined },
  ]
})

const chartMetrics = computed(() => {
  if (!server.value || !rawServer.value) return []
  const raw = rawServer.value
  const loadValues = server.value.load.split('/').map((value) => Number.parseFloat(value.trim()) || 0)
  return [
    { key: 'cpu', title: 'CPU 使用率', current: `${server.value.cpu}%`, color: '#00a88f', unit: '%', series: [
      { label: 'CPU', color: '#00a88f', values: historyNumbers(history.value, 'cpu') },
    ] },
    { key: 'load', title: '系统负载', current: loadValues[0]?.toFixed(2) || '0.00', color: '#1677ff', unit: '', series: [
      { label: '1m', color: '#00a88f', values: historyLoad(history.value, 0), fill: false },
      { label: '5m', color: '#d48806', values: historyLoad(history.value, 1), fill: false },
      { label: '15m', color: '#1677ff', values: historyLoad(history.value, 2), fill: false },
    ] },
    { key: 'memory', title: '内存使用率', current: `${server.value.memory}%`, color: '#722ed1', unit: '%', series: [
      { label: '内存', color: '#722ed1', values: historyPercents(history.value, 'ram_used', 'ram_total') },
      { label: 'Swap', color: '#f38020', values: historyPercents(history.value, 'swap_used', 'swap_total') },
    ] },
    { key: 'disk', title: '磁盘使用率', current: `${server.value.disk}%`, color: '#13a8a8', unit: '%', series: [
      { label: '磁盘', color: '#13a8a8', values: historyPercents(history.value, 'disk_used', 'disk_total') },
    ] },
    { key: 'network', title: '网络吞吐', current: `↓ ${server.value.download} / ↑ ${server.value.upload}`, color: '#16a34a', unit: ' KB/s', series: [
      { label: '下行', color: '#00a88f', values: historyNumbers(history.value, 'net_in_speed').map((value) => value / 1024) },
      { label: '上行', color: '#1677ff', values: historyNumbers(history.value, 'net_out_speed').map((value) => value / 1024) },
    ] },
    { key: 'process', title: '进程数', current: String(raw.processes || 0), color: '#d4388c', unit: '', series: [
      { label: '进程', color: '#d4388c', values: historyNumbers(history.value, 'processes') },
    ] },
    { key: 'connections', title: 'TCP / UDP 连接', current: `TCP ${raw.tcp_conn || 0} · UDP ${raw.udp_conn || 0}`, color: '#2f54eb', unit: '', series: [
      { label: 'TCP', color: '#2f54eb', values: historyNumbers(history.value, 'tcp_conn'), fill: false },
      { label: 'UDP', color: '#d4388c', values: historyNumbers(history.value, 'udp_conn'), fill: false },
    ] },
    { key: 'latency', title: '四网延迟', current: server.value.latency === null ? '超时' : `CT ${raw.ping_ct || '-'} ms`, color: '#eb2f96', unit: ' ms', series: [
      { label: '电信', color: '#00a88f', values: historyNumbers(history.value, 'ping_ct'), fill: false },
      { label: '联通', color: '#d48806', values: historyNumbers(history.value, 'ping_cu'), fill: false },
      { label: '移动', color: '#1677ff', values: historyNumbers(history.value, 'ping_cm'), fill: false },
      { label: '百度', color: '#722ed1', values: historyNumbers(history.value, 'ping_bd'), fill: false },
    ] },
    { key: 'loss', title: '丢包率', current: `${raw.loss_ct || 0}%`, color: '#dc2626', unit: '%', series: [
      { label: '电信', color: '#00a88f', values: historyNumbers(history.value, 'loss_ct'), fill: false },
      { label: '联通', color: '#d48806', values: historyNumbers(history.value, 'loss_cu'), fill: false },
      { label: '移动', color: '#1677ff', values: historyNumbers(history.value, 'loss_cm'), fill: false },
      { label: '百度', color: '#722ed1', values: historyNumbers(history.value, 'loss_bd'), fill: false },
    ] },
  ]
})

const rangeStartLabel = computed(() => currentHours.value < 1 ? `${Math.round(currentHours.value * 60)} 分钟前` : `${currentHours.value} 小时前`)

async function loadHistory(hours = currentHours.value) {
  historyError.value = ''
  try {
    history.value = await fetchAllHistory(String(route.params.id), hours, apiIndex.value)
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) loginModalOpen.value = true
    else historyError.value = error instanceof Error ? error.message : '历史数据加载失败'
  }
}

async function selectRange(value: string | number) {
  const hours = Number(value)
  if (hours > 1 && !isAdminLoggedIn()) {
    loginModalOpen.value = true
    return
  }
  currentHours.value = hours
  await loadHistory(hours)
}

onMounted(async () => {
  loading.value = true
  rawServer.value = await fetchServerDetail(String(route.params.id), apiIndex.value)
  if (!rawServer.value) detailError.value = '无法从监控 API 获取该节点'
  else await loadHistory()
  loading.value = false
})
</script>
