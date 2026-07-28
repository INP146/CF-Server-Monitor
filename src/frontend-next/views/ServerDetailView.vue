<template>
  <div class="detail-page" :class="{ 'is-dark': isDark }">
    <header class="topbar">
      <div class="topbar-inner">
        <div class="detail-header-left">
          <a-button type="text" href="#/">
            <template #icon><ArrowLeftOutlined /></template>
            返回监控页
          </a-button>
          <div v-if="server" class="detail-breadcrumb">
            <img :src="`/flags/${server.region}.svg`" alt="" />
            <strong>{{ server.name }}</strong>
          </div>
        </div>
        <div class="topbar-actions">
          <a-button type="text" href="#/admin"><template #icon><SettingOutlined /></template>后台</a-button>
          <a-tooltip :title="isDark ? '切换到浅色主题' : '切换到深色主题'">
            <a-button type="text" shape="circle" aria-label="切换主题" @click="$emit('toggle-theme')">
              <template #icon><BulbOutlined /></template>
            </a-button>
          </a-tooltip>
        </div>
      </div>
    </header>

    <main v-if="server" class="detail-content">
      <section class="detail-title-row">
        <div>
          <div class="detail-title-line">
            <h1>{{ server.name }}</h1>
            <a-badge :status="server.status === 'online' ? 'success' : 'error'" :text="server.status === 'online' ? '在线' : '离线'" />
          </div>
          <p>{{ server.location }} · {{ server.ip }} · {{ server.os }} {{ server.arch }}</p>
        </div>
        <a-segmented :value="currentHours" :options="timeOptions" @change="selectRange" />
      </section>

      <section class="detail-summary-grid" aria-label="节点摘要">
        <a-card v-for="item in summaryItems" :key="item.label" size="small">
          <span>{{ item.label }}</span>
          <strong :class="item.className">{{ item.value }}</strong>
        </a-card>
      </section>

      <section class="system-band">
        <div v-for="item in systemItems" :key="item.label" class="system-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
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
          <MetricChart :title="metric.title" :values="metric.values" :color="metric.color" />
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
import ASegmented from 'ant-design-vue/es/segmented'
import ATooltip from 'ant-design-vue/es/tooltip'
import { ArrowLeftOutlined, BulbOutlined, SettingOutlined } from '@ant-design/icons-vue'

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
    { label: 'CPU 使用率', value: `${server.value.cpu}%`, className: '' },
    { label: '内存使用率', value: `${server.value.memory}%`, className: '' },
    { label: '磁盘使用率', value: `${server.value.disk}%`, className: '' },
    { label: '网络延迟', value: server.value.latency === null ? '超时' : `${server.value.latency} ms`, className: server.value.latency === null ? 'metric-danger' : '' },
  ]
})

const systemItems = computed(() => {
  if (!server.value) return []
  return [
    { label: '系统', value: `${server.value.os} / ${server.value.arch}` },
    { label: 'CPU', value: `${server.value.arch === 'aarch64' ? 'Ampere Altra' : 'AMD EPYC 7B13'} · 4 核` },
    { label: '内存 / 磁盘', value: '3.8 GB / 80 GB' },
    { label: '运行时间', value: server.value.uptime },
    { label: '总流量', value: '↓ 18.42 TB / ↑ 7.96 TB' },
    { label: '最后上报', value: server.value.status === 'online' ? '刚刚' : '18 分钟前' },
  ]
})

const chartMetrics = computed(() => {
  if (!server.value) return []
  const factor = Math.max(1, Math.log2(currentHours.value + 1))
  return [
    { key: 'cpu', title: 'CPU 使用率', current: `${server.value.cpu}%`, color: '#f38020', values: createMetricSeries(seed.value, server.value.cpu, 8 * factor) },
    { key: 'load', title: '系统负载', current: server.value.load.split('/')[0]?.trim() || '0', color: '#1677ff', values: createMetricSeries(seed.value + 2, Math.max(0.2, server.value.cpu / 50), 0.3 * factor) },
    { key: 'memory', title: '内存使用率', current: `${server.value.memory}%`, color: '#722ed1', values: createMetricSeries(seed.value + 4, server.value.memory, 5 * factor) },
    { key: 'disk', title: '磁盘使用率', current: `${server.value.disk}%`, color: '#13a8a8', values: createMetricSeries(seed.value + 6, server.value.disk, 1.2 * factor) },
    { key: 'network', title: '网络吞吐', current: `↓ ${server.value.download}`, color: '#16a34a', values: createMetricSeries(seed.value + 8, 680, 220 * factor) },
    { key: 'process', title: '进程数', current: '142', color: '#d48806', values: createMetricSeries(seed.value + 10, 142, 12 * factor) },
    { key: 'connections', title: 'TCP / UDP 连接', current: '286 / 34', color: '#2f54eb', values: createMetricSeries(seed.value + 12, 286, 35 * factor) },
    { key: 'latency', title: '四网延迟', current: server.value.latency === null ? '超时' : `${server.value.latency} ms`, color: '#eb2f96', values: createMetricSeries(seed.value + 14, server.value.latency ?? 220, 15 * factor) },
    { key: 'loss', title: '丢包率', current: server.value.status === 'online' ? '0.3%' : '100%', color: '#dc2626', values: createMetricSeries(seed.value + 16, server.value.status === 'online' ? 0.3 : 100, 0.2 * factor) },
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
