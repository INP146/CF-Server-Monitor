<template>
  <a-card
    class="server-card"
    :class="{ offline: server.status === 'offline', 'is-list': listView }"
    hoverable
    tabindex="0"
    role="link"
    @click="openDetail"
    @keydown.enter="openDetail"
  >
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
          :text="server.status === 'online' ? t('online') : t('offline')"
        />
        <a-button type="text" size="small" :aria-label="t('openServerDetail')" @click.stop="openDetail">
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

    <div v-if="(config.show_price && server.priceText) || (config.show_expire && server.expireDate)" class="server-commercial-meta">
      <span v-if="config.show_price && server.priceText">{{ t('price') }} <strong>{{ server.priceText }}</strong></span>
      <span v-if="config.show_expire && server.expireDate">{{ t('expiry') }} <strong>{{ server.expireDate }}</strong></span>
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

    <a-descriptions
      class="server-telemetry"
      size="small"
      layout="horizontal"
      :column="{ xs: 1, sm: 2 }"
    >
      <a-descriptions-item>
        <template #label><span class="telemetry-label"><DownloadOutlined />{{ t('download') }}</span></template>
        <a-typography-text strong>{{ server.download }}</a-typography-text>
      </a-descriptions-item>
      <a-descriptions-item>
        <template #label><span class="telemetry-label"><UploadOutlined />{{ t('upload') }}</span></template>
        <a-typography-text strong>{{ server.upload }}</a-typography-text>
      </a-descriptions-item>
    </a-descriptions>

    <div v-if="config.show_tf" class="traffic-usage-row">
      <span>{{ t('monthlyTraffic') }} {{ server.trafficUsed || '0 B' }} / {{ displayTrafficLimit }}</span>
      <a-progress
        v-if="server.trafficLimitText && server.trafficLimitText !== '不限'"
        :percent="Math.min(100, server.trafficPercent || 0)"
        :show-info="false"
        :stroke-width="5"
        :status="(server.trafficPercent || 0) >= 95 ? 'exception' : 'normal'"
      />
    </div>

    <a-divider />

    <div class="server-card-foot">
      <span><ClockCircleOutlined /> {{ t('runtime') }} {{ server.uptime }}</span>
      <span>{{ t('load') }} {{ server.load }}</span>
    </div>
    <div v-if="config.show_time" class="server-data-time">{{ t('dataTime') }} {{ server.dataTime || '-' }}</div>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AButton from 'ant-design-vue/es/button'
import ABadge from 'ant-design-vue/es/badge'
import ACard from 'ant-design-vue/es/card'
import ADescriptions, { DescriptionsItem as ADescriptionsItem } from 'ant-design-vue/es/descriptions'
import ADivider from 'ant-design-vue/es/divider'
import AProgress from 'ant-design-vue/es/progress'
import ATag from 'ant-design-vue/es/tag'
import { TypographyText as ATypographyText } from 'ant-design-vue/es/typography'
import {
  ClockCircleOutlined,
  DownloadOutlined,
  RightOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'

import type { MockServer } from '../data/dashboard'
import type { DashboardConfig } from '../types/dashboard'
import { getOSImage } from '../utils/os-icon'
import { DEFAULT_SERVER_CARD_CONFIG } from '../utils/server-card'
import { t } from '../utils/i18n'

const props = withDefaults(defineProps<{
  server: MockServer
  config?: DashboardConfig
  listView?: boolean
}>(), {
  config: () => ({ ...DEFAULT_SERVER_CARD_CONFIG, site_title: 'EdgeProbe' }),
  listView: false,
})

const router = useRouter()

const metrics = computed(() => [
  { label: 'CPU', value: props.server.cpu },
  { label: t('memory'), value: props.server.memory },
  { label: t('disk'), value: props.server.disk },
])
const displayTrafficLimit = computed(() => props.server.trafficLimitText && props.server.trafficLimitText !== '不限'
  ? props.server.trafficLimitText
  : t('unlimited'))

function metricColor(value: number): string {
  if (value >= 85) return '#dc2626'
  if (value >= 65) return '#eab308'
  return '#16a34a'
}

function openDetail() {
  void router.push({ path: `/server/${props.server.id}`, query: props.server.apiIndex ? { api: props.server.apiIndex } : {} })
}
</script>
