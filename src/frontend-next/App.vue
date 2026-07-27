<template>
  <n-config-provider :theme="isDark ? darkTheme : null" :theme-overrides="themeOverrides">
    <n-global-style />
    <div class="app-shell" :class="{ 'is-dark': isDark }">
      <main class="dashboard-main">
        <header class="topbar">
          <div class="topbar-inner">
            <div class="topbar-brand">
              <span class="brand-mark"><Cloud :size="20" :stroke-width="2.4" /></span>
              <span class="brand-copy">
                <strong>EdgeProbe</strong>
                <small>SERVER MONITOR</small>
              </span>
            </div>

            <div class="topbar-actions">
              <a class="admin-link" href="/admin">
                <Settings :size="16" />
                <span>管理后台</span>
              </a>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button quaternary circle aria-label="切换主题" @click="isDark = !isDark">
                    <template #icon>
                      <n-icon :component="isDark ? Sun : Moon" />
                    </template>
                  </n-button>
                </template>
                {{ isDark ? '切换到浅色主题' : '切换到深色主题' }}
              </n-tooltip>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button quaternary circle aria-label="通知">
                    <template #icon><n-icon :component="Bell" /></template>
                  </n-button>
                </template>
                暂无新通知
              </n-tooltip>
              <div class="avatar">EP</div>
            </div>
          </div>
        </header>

        <div class="dashboard-content">
          <section class="summary-grid" aria-label="监控摘要">
            <article class="summary-card">
              <div class="summary-icon orange"><ServerIcon :size="20" /></div>
              <div class="summary-copy">
                <span>服务器</span>
                <strong>{{ servers.length }}</strong>
              </div>
              <div class="summary-foot"><span class="status-dot online" /> {{ onlineCount }} 台在线</div>
            </article>
            <article class="summary-card">
              <div class="summary-icon green"><Activity :size="20" /></div>
              <div class="summary-copy">
                <span>可用率</span>
                <strong>99.98<small>%</small></strong>
              </div>
              <div class="summary-foot positive"><TrendingUp :size="14" /> 本月 +0.12%</div>
            </article>
            <article class="summary-card">
              <div class="summary-icon blue"><Download :size="20" /></div>
              <div class="summary-copy">
                <span>下载速率</span>
                <strong>3.84<small> MB/s</small></strong>
              </div>
              <div class="summary-foot muted">总计 18.42 TB</div>
            </article>
            <article class="summary-card">
              <div class="summary-icon yellow"><Upload :size="20" /></div>
              <div class="summary-copy">
                <span>上传速率</span>
                <strong>1.27<small> MB/s</small></strong>
              </div>
              <div class="summary-foot muted">总计 7.96 TB</div>
            </article>
          </section>

          <section class="fleet-section">
            <div class="section-toolbar">
              <div>
                <h2>节点状态</h2>
                <p>{{ filteredServers.length }} 个节点符合当前条件</p>
              </div>
              <div class="toolbar-controls">
                <n-input v-model:value="query" clearable placeholder="搜索节点" class="search-input">
                  <template #prefix><n-icon :component="Search" /></template>
                </n-input>
                <n-button-group>
                  <n-tooltip trigger="hover">
                    <template #trigger>
                      <n-button :type="view === 'grid' ? 'primary' : 'default'" aria-label="网格视图" @click="view = 'grid'">
                        <template #icon><n-icon :component="LayoutGrid" /></template>
                      </n-button>
                    </template>
                    网格视图
                  </n-tooltip>
                  <n-tooltip trigger="hover">
                    <template #trigger>
                      <n-button :type="view === 'list' ? 'primary' : 'default'" aria-label="列表视图" @click="view = 'list'">
                        <template #icon><n-icon :component="List" /></template>
                      </n-button>
                    </template>
                    列表视图
                  </n-tooltip>
                </n-button-group>
              </div>
            </div>

            <div class="filter-row">
              <button
                v-for="filter in filters"
                :key="filter.value"
                type="button"
                class="filter-pill"
                :class="{ active: activeFilter === filter.value }"
                @click="activeFilter = filter.value"
              >
                <span v-if="filter.value === 'online'" class="status-dot online" />
                <span v-else-if="filter.value === 'offline'" class="status-dot offline" />
                <img v-else-if="filter.flag" :src="`/flags/${filter.flag}.svg`" alt="" />
                {{ filter.label }}
                <b>{{ filter.count }}</b>
              </button>
            </div>

            <div v-if="filteredServers.length" class="server-grid" :class="{ 'list-view': view === 'list' }">
              <ServerCard
                v-for="server in filteredServers"
                :key="server.id"
                :server="server"
                :list-view="view === 'list'"
              />
            </div>
            <n-empty v-else description="没有符合条件的节点" class="empty-result">
              <template #extra>
                <n-button size="small" @click="clearFilters">清除筛选</n-button>
              </template>
            </n-empty>
          </section>

        </div>
      </main>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  darkTheme,
  NButton,
  NButtonGroup,
  NConfigProvider,
  NEmpty,
  NGlobalStyle,
  NIcon,
  NInput,
  NTooltip,
  type GlobalThemeOverrides,
} from 'naive-ui'
import {
  Activity,
  Bell,
  Cloud,
  Download,
  LayoutGrid,
  List,
  Moon,
  Search,
  Server as ServerIcon,
  Settings,
  Sun,
  TrendingUp,
  Upload,
} from '@lucide/vue'

import ServerCard from './components/ServerCard.vue'
import { dashboardServers } from './data/dashboard'

const isDark = ref(false)
const view = ref<'grid' | 'list'>('grid')
const activeFilter = ref('all')
const query = ref('')
const servers = dashboardServers

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#f38020',
    primaryColorHover: '#ff9f43',
    primaryColorPressed: '#d96710',
    primaryColorSuppl: '#f38020',
    borderRadius: '6px',
    borderRadiusSmall: '5px',
  },
  Button: {
    fontWeight: '600',
  },
  Input: {
    borderHover: '1px solid #f38020',
    borderFocus: '1px solid #f38020',
    boxShadowFocus: '0 0 0 2px rgba(243, 128, 32, 0.14)',
  },
}

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
