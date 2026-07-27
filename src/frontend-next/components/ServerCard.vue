<template>
  <a-card class="server-card" :class="{ offline: server.status === 'offline', 'is-list': listView }" hoverable>
    <template #title>
      <div class="server-card-title">
        <img :src="`/flags/${server.region}.svg`" alt="" />
        <div>
          <strong>{{ server.name }}</strong>
          <span>{{ server.location }} · {{ server.ip }}</span>
        </div>
      </div>
    </template>
    <template #extra>
      <div class="server-card-extra">
        <a-badge
          :status="server.status === 'online' ? 'success' : 'error'"
          :text="server.status === 'online' ? '在线' : '离线'"
        />
        <a-button type="text" size="small" aria-label="打开节点详情">
          <template #icon><RightOutlined /></template>
        </a-button>
      </div>
    </template>

    <div class="server-meta">
      <span class="os-name">
        <img :src="`/${getOSImage(server.os)}`" alt="" />
        {{ server.os }} · {{ server.arch }}
      </span>
      <span class="tag-list">
        <a-tag v-for="tag in server.tags" :key="tag" color="blue">{{ tag }}</a-tag>
      </span>
    </div>

    <div class="metric-bars">
      <div v-for="metric in metrics" :key="metric.label" class="metric-row">
        <span>{{ metric.label }}</span>
        <a-progress
          :percent="metric.value"
          :stroke-width="7"
          :show-info="false"
          :status="metric.value >= 85 ? 'exception' : 'normal'"
          :stroke-color="metricColor(metric.value)"
        />
        <strong>{{ metric.value }}%</strong>
      </div>
    </div>

    <a-divider />

    <div class="network-grid">
      <div>
        <span><DownloadOutlined /> 下载</span>
        <strong>{{ server.download }}</strong>
      </div>
      <div>
        <span><UploadOutlined /> 上传</span>
        <strong>{{ server.upload }}</strong>
      </div>
      <div>
        <span><WifiOutlined /> 延迟</span>
        <strong :class="latencyClass">{{ server.latency === null ? '超时' : `${server.latency} ms` }}</strong>
      </div>
    </div>

    <a-divider />

    <div class="server-card-foot">
      <span><ClockCircleOutlined /> 运行 {{ server.uptime }}</span>
      <span>负载 {{ server.load }}</span>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AButton from 'ant-design-vue/es/button'
import ABadge from 'ant-design-vue/es/badge'
import ACard from 'ant-design-vue/es/card'
import ADivider from 'ant-design-vue/es/divider'
import AProgress from 'ant-design-vue/es/progress'
import ATag from 'ant-design-vue/es/tag'
import {
  ClockCircleOutlined,
  DownloadOutlined,
  RightOutlined,
  UploadOutlined,
  WifiOutlined,
} from '@ant-design/icons-vue'

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
