<template>
  <div class="detail-page" :class="{ 'is-dark': isDark }">
    <AppHeader subtitle="SERVER DETAILS" :is-dark="isDark" @toggle-theme="$emit('toggle-theme')">
      <a-button type="text" href="#/"><template #icon><ArrowLeftOutlined /></template>返回监控页</a-button>
      <a-button type="text" href="#/admin"><template #icon><SettingOutlined /></template>管理后台</a-button>
    </AppHeader>

    <main v-if="server" class="detail-content">
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
    </main>

    <main v-else class="detail-content detail-empty">
      <a-result status="404" title="找不到节点" sub-title="该静态节点不存在或已经删除">
        <template #extra><a-button type="primary" href="#/">返回监控页</a-button></template>
      </a-result>
    </main>

    <a-modal v-model:open="loginModalOpen" title="需要管理员登录" :footer="null">
      <p>查看 24 小时以上的历史记录需要管理员权限。</p>
      <a-button type="primary" block :href="`#/admin?redirect=/server/${route.params.id}`">前往登录</a-button>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AButton from 'ant-design-vue/es/button'
import ABadge from 'ant-design-vue/es/badge'
import ACard from 'ant-design-vue/es/card'
import AModal from 'ant-design-vue/es/modal'
import AResult from 'ant-design-vue/es/result'
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
import { dashboardServers } from '../data/dashboard'
import { createMetricSeries } from '../utils/mock-admin'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const route = useRoute()
const currentHours = ref(1)
const loginModalOpen = ref(false)
const server = computed(() => dashboardServers.find((item) => item.id === String(route.params.id)))
const seed = computed(() => Math.max(1, dashboardServers.findIndex((item) => item.id === server.value?.id) + 1))

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
  if (!server.value) return []
  return [
    { label: '系统', value: `${server.value.os} / ${server.value.arch}`, icon: DesktopOutlined },
    { label: '内核', value: server.value.arch === 'aarch64' ? '6.8.0-31-generic' : '6.8.0-45-generic', icon: CodeOutlined },
    { label: 'CPU', value: `${server.value.arch === 'aarch64' ? 'Ampere Altra' : 'AMD EPYC 7B13'} · 4 核`, icon: DashboardOutlined },
    { label: '内存 / 磁盘', value: '3.8 GB / 80 GB', icon: HddOutlined },
    { label: '系统负载', value: server.value.load, icon: LineChartOutlined },
    { label: '运行时间', value: server.value.uptime, icon: FieldTimeOutlined },
    { label: '启动时间', value: server.value.status === 'online' ? '2026-03-22 08:14' : '-', icon: PoweroffOutlined },
    { label: '最后上报', value: server.value.status === 'online' ? '刚刚' : '18 分钟前', icon: ClockCircleOutlined },
    { label: '总流量', value: '↓ 18.42 TB / ↑ 7.96 TB', icon: CloudDownloadOutlined },
    { label: '实时网速', value: `↓ ${server.value.download} / ↑ ${server.value.upload}`, icon: SwapOutlined },
    { label: '本月流量', value: '↓ 6.84 TB / ↑ 1.72 TB', icon: CalendarOutlined },
    { label: '月流量限额', value: '8.56 TB / 20 TB', icon: DatabaseOutlined },
  ]
})

const chartMetrics = computed(() => {
  if (!server.value) return []
  const factor = Math.max(1, Math.log2(currentHours.value + 1))
  const loadValues = server.value.load.split('/').map((value) => Number.parseFloat(value.trim()) || 0)
  const download = Number.parseFloat(server.value.download) || 0
  const upload = Number.parseFloat(server.value.upload) || 0
  const latency = server.value.latency ?? 220
  const loss = server.value.status === 'online' ? [0.3, 0.5, 0.2, 0.4] : [100, 100, 100, 100]
  return [
    { key: 'cpu', title: 'CPU 使用率', current: `${server.value.cpu}%`, color: '#00a88f', unit: '%', series: [
      { label: 'CPU', color: '#00a88f', values: createMetricSeries(seed.value, server.value.cpu, 8 * factor) },
    ] },
    { key: 'load', title: '系统负载', current: loadValues[0]?.toFixed(2) || '0.00', color: '#1677ff', unit: '', series: [
      { label: '1m', color: '#00a88f', values: createMetricSeries(seed.value + 2, loadValues[0] || 0.2, 0.3 * factor), fill: false },
      { label: '5m', color: '#d48806', values: createMetricSeries(seed.value + 3, loadValues[1] || 0.2, 0.22 * factor), fill: false },
      { label: '15m', color: '#1677ff', values: createMetricSeries(seed.value + 4, loadValues[2] || 0.2, 0.16 * factor), fill: false },
    ] },
    { key: 'memory', title: '内存使用率', current: `${server.value.memory}%`, color: '#722ed1', unit: '%', series: [
      { label: '内存', color: '#722ed1', values: createMetricSeries(seed.value + 4, server.value.memory, 5 * factor) },
      { label: 'Swap', color: '#f38020', values: createMetricSeries(seed.value + 5, 4, 1.4 * factor) },
    ] },
    { key: 'disk', title: '磁盘使用率', current: `${server.value.disk}%`, color: '#13a8a8', unit: '%', series: [
      { label: '磁盘', color: '#13a8a8', values: createMetricSeries(seed.value + 6, server.value.disk, 1.2 * factor) },
    ] },
    { key: 'network', title: '网络吞吐', current: `↓ ${server.value.download} / ↑ ${server.value.upload}`, color: '#16a34a', unit: ' KB/s', series: [
      { label: '下行', color: '#00a88f', values: createMetricSeries(seed.value + 8, download, 220 * factor) },
      { label: '上行', color: '#1677ff', values: createMetricSeries(seed.value + 9, upload, 80 * factor) },
    ] },
    { key: 'process', title: '进程数', current: '142', color: '#d4388c', unit: '', series: [
      { label: '进程', color: '#d4388c', values: createMetricSeries(seed.value + 10, 142, 12 * factor) },
    ] },
    { key: 'connections', title: 'TCP / UDP 连接', current: 'TCP 286 · UDP 34', color: '#2f54eb', unit: '', series: [
      { label: 'TCP', color: '#2f54eb', values: createMetricSeries(seed.value + 12, 286, 35 * factor), fill: false },
      { label: 'UDP', color: '#d4388c', values: createMetricSeries(seed.value + 13, 34, 8 * factor), fill: false },
    ] },
    { key: 'latency', title: '四网延迟', current: server.value.latency === null ? '超时' : `CT ${server.value.latency} ms`, color: '#eb2f96', unit: ' ms', series: [
      { label: '电信', color: '#00a88f', values: createMetricSeries(seed.value + 14, latency, 15 * factor), fill: false },
      { label: '联通', color: '#d48806', values: createMetricSeries(seed.value + 15, latency + 12, 18 * factor), fill: false },
      { label: '移动', color: '#1677ff', values: createMetricSeries(seed.value + 16, latency + 25, 20 * factor), fill: false },
      { label: '百度', color: '#722ed1', values: createMetricSeries(seed.value + 17, latency + 6, 13 * factor), fill: false },
    ] },
    { key: 'loss', title: '丢包率', current: `${loss[0]}%`, color: '#dc2626', unit: '%', series: [
      { label: '电信', color: '#00a88f', values: createMetricSeries(seed.value + 18, loss[0], 0.2 * factor), fill: false },
      { label: '联通', color: '#d48806', values: createMetricSeries(seed.value + 19, loss[1], 0.25 * factor), fill: false },
      { label: '移动', color: '#1677ff', values: createMetricSeries(seed.value + 20, loss[2], 0.16 * factor), fill: false },
      { label: '百度', color: '#722ed1', values: createMetricSeries(seed.value + 21, loss[3], 0.2 * factor), fill: false },
    ] },
  ]
})

const rangeStartLabel = computed(() => currentHours.value < 1 ? `${Math.round(currentHours.value * 60)} 分钟前` : `${currentHours.value} 小时前`)

function selectRange(value: string | number) {
  const hours = Number(value)
  if (hours > 24 && window.sessionStorage.getItem('edgeprobe-admin') !== 'true') {
    loginModalOpen.value = true
    return
  }
  currentHours.value = hours
}
</script>
