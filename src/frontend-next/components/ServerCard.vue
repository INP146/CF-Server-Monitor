<template>
  <article class="server-card" :class="{ offline: server.status === 'offline', 'is-list': listView }">
    <div class="server-card-head">
      <div class="server-identity">
        <span class="flag-wrap"><img :src="`/flags/${server.region}.svg`" alt="" /></span>
        <div class="server-title">
          <div class="name-row">
            <h3>{{ server.name }}</h3>
            <span class="status-badge" :class="server.status">
              <span class="status-dot" :class="server.status" />
              {{ server.status === 'online' ? '在线' : '离线' }}
            </span>
          </div>
          <p>{{ server.location }} · {{ server.ip }}</p>
        </div>
      </div>
      <n-button quaternary circle aria-label="打开节点详情">
        <template #icon><n-icon :component="ChevronRight" /></template>
      </n-button>
    </div>

    <div class="system-row">
      <span class="os-icon"><img :src="`/${getOSImage(server.os)}`" alt="" /></span>
      <span>{{ server.os }}</span>
      <span class="separator" />
      <span>{{ server.arch }}</span>
      <span class="tag-list">
        <n-tag v-for="tag in server.tags" :key="tag" size="small" :bordered="false">{{ tag }}</n-tag>
      </span>
    </div>

    <div class="metric-bars">
      <div v-for="metric in metrics" :key="metric.label" class="metric-row">
        <span>{{ metric.label }}</span>
        <n-progress
          type="line"
          :percentage="metric.value"
          :height="6"
          :border-radius="3"
          :show-indicator="false"
          :color="metricColor(metric.value)"
          rail-color="var(--progress-rail)"
        />
        <strong>{{ metric.value }}%</strong>
      </div>
    </div>

    <div class="network-grid">
      <div>
        <span><Download :size="14" /> 下载</span>
        <strong>{{ server.download }}</strong>
      </div>
      <div>
        <span><Upload :size="14" /> 上传</span>
        <strong>{{ server.upload }}</strong>
      </div>
      <div>
        <span><Radio :size="14" /> 延迟</span>
        <strong :class="latencyClass">{{ server.latency === null ? '超时' : `${server.latency} ms` }}</strong>
      </div>
    </div>

    <div class="server-card-foot">
      <span><Clock3 :size="14" /> 运行 {{ server.uptime }}</span>
      <span>负载 {{ server.load }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NIcon, NProgress, NTag } from 'naive-ui'
import { ChevronRight, Clock3, Download, Radio, Upload } from '@lucide/vue'

import type { MockServer } from '../data/dashboard'
import { getOSImage } from '../utils/os-icon'

const props = withDefaults(defineProps<{
  server: MockServer
  listView?: boolean
}>(), {
  listView: false,
})

const metrics = computed(() => [
  { label: 'CPU', value: props.server.cpu },
  { label: '内存', value: props.server.memory },
  { label: '磁盘', value: props.server.disk },
])

const latencyClass = computed(() => {
  if (props.server.latency === null || props.server.latency >= 180) return 'metric-danger'
  if (props.server.latency >= 100) return 'metric-warning'
  return 'metric-healthy'
})

function metricColor(value: number): string {
  if (value >= 85) return '#dc2626'
  if (value >= 65) return '#eab308'
  return '#16a34a'
}
</script>
