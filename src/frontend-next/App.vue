<template>
  <a-config-provider :theme="themeConfig">
    <div class="app-shell" :class="{ 'is-dark': isDark }">
      <main class="dashboard-main">
        <header class="topbar">
          <div class="topbar-inner">
            <div class="topbar-brand">
              <span class="brand-mark"><CloudOutlined /></span>
              <span class="brand-copy">
                <strong>EdgeProbe</strong>
                <small>SERVER MONITOR</small>
              </span>
            </div>

            <div class="topbar-actions">
              <a-button type="text" href="/admin">
                <template #icon><SettingOutlined /></template>
                管理后台
              </a-button>
              <a-tooltip :title="isDark ? '切换到浅色主题' : '切换到深色主题'">
                <a-button type="text" shape="circle" aria-label="切换主题" @click="isDark = !isDark">
                  <template #icon><BulbOutlined /></template>
                </a-button>
              </a-tooltip>
            </div>
          </div>
        </header>

        <div class="dashboard-content">
          <section class="summary-grid" aria-label="监控摘要">
            <a-card class="summary-card">
              <a-statistic title="服务器" :value="servers.length">
                <template #prefix><CloudServerOutlined class="stat-icon orange" /></template>
              </a-statistic>
              <div class="summary-foot"><span class="status-dot online" /> {{ onlineCount }} 台在线</div>
            </a-card>
            <a-card class="summary-card">
              <a-statistic title="可用率" :value="99.98" :precision="2" suffix="%">
                <template #prefix><LineChartOutlined class="stat-icon green" /></template>
              </a-statistic>
              <div class="summary-foot positive"><RiseOutlined /> 本月 +0.12%</div>
            </a-card>
            <a-card class="summary-card">
              <a-statistic title="下载速率" :value="3.84" :precision="2" suffix="MB/s">
                <template #prefix><DownloadOutlined class="stat-icon blue" /></template>
              </a-statistic>
              <div class="summary-foot muted">总计 18.42 TB</div>
            </a-card>
            <a-card class="summary-card">
              <a-statistic title="上传速率" :value="1.27" :precision="2" suffix="MB/s">
                <template #prefix><UploadOutlined class="stat-icon yellow" /></template>
              </a-statistic>
              <div class="summary-foot muted">总计 7.96 TB</div>
            </a-card>
          </section>

          <section class="fleet-section">
            <div class="fleet-toolbar">
              <a-radio-group v-model:value="activeFilter" button-style="solid" class="filter-group">
                <a-radio-button
                  v-for="filter in filters"
                  :key="filter.value"
                  :value="filter.value"
                >
                  <span class="filter-label">
                    <span v-if="filter.value === 'online'" class="status-dot online" />
                    <span v-else-if="filter.value === 'offline'" class="status-dot offline" />
                    <img v-else-if="filter.flag" :src="`/flags/${filter.flag}.svg`" alt="" />
                    {{ filter.label }}
                    <small>{{ filter.count }}</small>
                  </span>
                </a-radio-button>
              </a-radio-group>

              <div class="toolbar-controls">
                <a-input v-model:value="query" allow-clear placeholder="搜索节点" class="search-input">
                  <template #prefix><SearchOutlined /></template>
                </a-input>
                <a-button-group>
                  <a-tooltip title="网格视图">
                    <a-button :type="view === 'grid' ? 'primary' : 'default'" aria-label="网格视图" @click="view = 'grid'">
                      <template #icon><AppstoreOutlined /></template>
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="列表视图">
                    <a-button :type="view === 'list' ? 'primary' : 'default'" aria-label="列表视图" @click="view = 'list'">
                      <template #icon><UnorderedListOutlined /></template>
                    </a-button>
                  </a-tooltip>
                </a-button-group>
              </div>
            </div>

            <div v-if="filteredServers.length" class="server-grid" :class="{ 'list-view': view === 'list' }">
              <ServerCard
                v-for="server in filteredServers"
                :key="server.id"
                :server="server"
                :list-view="view === 'list'"
              />
            </div>
            <a-empty v-else description="没有符合条件的节点" class="empty-result">
              <a-button size="small" @click="clearFilters">清除筛选</a-button>
            </a-empty>
          </section>

        </div>
      </main>
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AButton, { ButtonGroup as AButtonGroup } from 'ant-design-vue/es/button'
import ACard from 'ant-design-vue/es/card'
import AConfigProvider from 'ant-design-vue/es/config-provider'
import AEmpty from 'ant-design-vue/es/empty'
import AInput from 'ant-design-vue/es/input'
import { RadioButton as ARadioButton, RadioGroup as ARadioGroup } from 'ant-design-vue/es/radio'
import AStatistic from 'ant-design-vue/es/statistic'
import antTheme from 'ant-design-vue/es/theme'
import ATooltip from 'ant-design-vue/es/tooltip'
import {
  AppstoreOutlined,
  BulbOutlined,
  CloudOutlined,
  CloudServerOutlined,
  DownloadOutlined,
  LineChartOutlined,
  RiseOutlined,
  SearchOutlined,
  SettingOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'

import ServerCard from './components/ServerCard.vue'
import { dashboardServers } from './data/dashboard'

const isDark = ref(false)
const view = ref<'grid' | 'list'>('grid')
const activeFilter = ref('all')
const query = ref('')
const servers = dashboardServers

const themeConfig = computed(() => ({
  algorithm: isDark.value ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#f38020',
    colorLink: '#d96710',
    borderRadius: 6,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
}))

const onlineCount = computed(() => servers.filter((server) => server.status === 'online').length)

const filters = computed(() => [
  { label: '全部', value: 'all', count: servers.length },
  { label: '在线', value: 'online', count: onlineCount.value },
  { label: '离线', value: 'offline', count: servers.length - onlineCount.value },
  { label: '美国', value: 'us', count: servers.filter((server) => server.region === 'us').length, flag: 'us' },
  { label: '日本', value: 'jp', count: servers.filter((server) => server.region === 'jp').length, flag: 'jp' },
  { label: '德国', value: 'de', count: servers.filter((server) => server.region === 'de').length, flag: 'de' },
  { label: '新加坡', value: 'sg', count: servers.filter((server) => server.region === 'sg').length, flag: 'sg' },
])

const filteredServers = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return servers.filter((server) => {
    const filterMatches = activeFilter.value === 'all'
      || server.status === activeFilter.value
      || server.region === activeFilter.value
    const queryMatches = !normalizedQuery
      || `${server.name} ${server.location} ${server.ip} ${server.os}`.toLowerCase().includes(normalizedQuery)
    return filterMatches && queryMatches
  })
})

function clearFilters() {
  activeFilter.value = 'all'
  query.value = ''
}

</script>
