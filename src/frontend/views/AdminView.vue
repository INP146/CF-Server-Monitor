<template>
  <div class="admin-page" :class="{ 'is-dark': isDark }">
    <AppHeader :title="settings.siteTitle || 'EdgeProbe'" subtitle="ADMIN CONSOLE" :is-dark="isDark" @toggle-theme="$emit('toggle-theme')">
      <a-select v-if="apiEndpoints.length > 1" v-model:value="apiEndpoint" class="header-site-select" :aria-label="t('adminSite')"><a-select-option v-for="endpoint in apiEndpoints" :key="endpoint.value" :value="endpoint.value">{{ endpoint.label }}</a-select-option></a-select>
      <a-button type="text" href="#/"><template #icon><HomeOutlined /></template>{{ t('dashboard') }}</a-button>
      <template #end><a-button type="text" danger @click="logout"><template #icon><LogoutOutlined /></template>{{ t('logout') }}</a-button></template>
    </AppHeader>

    <main class="admin-content">
      <FleetSummary
        class="admin-overview-grid"
        :total="stats.total"
        :online="stats.online"
        :offline="stats.offline"
        :average-cpu="stats.averageCpu"
        :download-rate="stats.downloadRate"
        :download-total="t('realtimeTotal')"
        :upload-rate="stats.uploadRate"
        :upload-total="t('realtimeTotal')"
      />

      <a-alert v-if="feedback" :type="feedback.type" show-icon closable :message="feedback.message" class="admin-feedback" @close="feedback = null">
        <template v-if="settingsApiIndex === null" #action><a-button size="small" :loading="refreshing" @click="loadAdmin">{{ t('retry') }}</a-button></template>
      </a-alert>

      <a-tabs v-model:active-key="activeTab" class="admin-tabs">
        <a-tab-pane key="servers" :tab="t('serversTab')">
          <div class="admin-toolbar">
            <div class="admin-filters">
              <a-input v-model:value="search" allow-clear :placeholder="t('searchAdmin')" class="admin-search"><template #prefix><SearchOutlined /></template></a-input>
              <a-select v-model:value="statusFilter" class="status-select"><a-select-option value="all">{{ t('allStatuses') }}</a-select-option><a-select-option value="online">{{ t('online') }}</a-select-option><a-select-option value="offline">{{ t('offline') }}</a-select-option><a-select-option value="hidden">{{ t('hidden') }}</a-select-option></a-select>
            </div>
            <div class="admin-toolbar-actions">
              <a-popconfirm v-if="selectedIds.length" :title="t('deleteSelectedConfirm', { count: selectedIds.length })" :ok-text="t('delete')" :cancel-text="t('cancel')" @confirm="batchDelete"><a-button danger><template #icon><DeleteOutlined /></template>{{ t('deleteItems', { count: selectedIds.length }) }}</a-button></a-popconfirm>
              <a-button :loading="refreshing" @click="refreshServers"><template #icon><ReloadOutlined /></template>{{ t('refresh') }}</a-button>
              <a-button type="primary" :disabled="settingsApiIndex !== apiIndex" @click="openCreateModal"><template #icon><PlusOutlined /></template>{{ t('addServer') }}</a-button>
            </div>
          </div>

          <a-table class="admin-table" :columns="columns" :data-source="filteredServers" :row-selection="rowSelection" :pagination="{ pageSize: 8, hideOnSinglePage: true }" :scroll="{ x: 1540 }" :loading="refreshing" row-key="id" size="middle">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'sort'"><div class="sort-actions"><a-button type="text" size="small" :aria-label="t('moveUp')" @click="moveServer(record.id, -1)"><template #icon><ArrowUpOutlined /></template></a-button><a-button type="text" size="small" :aria-label="t('moveDown')" @click="moveServer(record.id, 1)"><template #icon><ArrowDownOutlined /></template></a-button></div></template>
              <template v-else-if="column.key === 'name'"><a :href="adminDetailHref(record.id)" class="admin-server-name"><img :src="`/flags/${record.region}.svg`" alt="" /><span><strong>{{ record.name }}</strong><small>{{ record.id }}</small></span></a></template>
              <template v-else-if="column.key === 'group'"><a-tag>{{ record.group }}</a-tag></template>
              <template v-else-if="column.key === 'tags'"><span class="compact-tags"><a-tag v-for="tag in record.tags" :key="tag" color="blue">{{ tag }}</a-tag></span></template>
              <template v-else-if="column.key === 'note'"><a-tooltip :title="t('doubleClickCopy')"><span class="note-cell" @dblclick="copyNote(record.note)">{{ record.note || '-' }}</span></a-tooltip></template>
              <template v-else-if="column.key === 'billing'"><span>{{ record.currency }}{{ record.price.toFixed(2) }}/{{ billingLabel(record.billingCycle) }}</span></template>
              <template v-else-if="column.key === 'expire'"><span :class="{ 'text-danger': isExpiring(record.expireDate) }">{{ record.expireDate || '-' }}</span><small v-if="record.autoRenewal" class="cell-subtext">{{ t('autoRenewalShort') }}</small></template>
              <template v-else-if="column.key === 'traffic'">{{ record.trafficLimit ? `${record.trafficLimit} GB` : t('unlimited') }}</template>
              <template v-else-if="column.key === 'version'"><a-tooltip :title="agentVersionTitle(record.agentVersion)"><span :class="agentVersionClass(record.agentVersion)">{{ record.agentVersion }}</span></a-tooltip></template>
              <template v-else-if="column.key === 'status'"><a-badge :status="record.status === 'online' ? 'success' : 'error'" :text="record.status === 'online' ? t('online') : t('offline')" /></template>
              <template v-else-if="column.key === 'enabled'"><a-switch :checked="record.enabled" size="small" @change="toggleServerEnabled(record, Boolean($event))" /></template>
              <template v-else-if="column.key === 'actions'"><div class="table-actions"><a-tooltip :title="t('installCommand')"><a-button type="text" shape="circle" :aria-label="t('installCommand')" :disabled="settingsApiIndex !== apiIndex" @click="openCommandModal(record)"><template #icon><CodeOutlined /></template></a-button></a-tooltip><a-tooltip :title="t('edit')"><a-button type="text" shape="circle" :aria-label="t('edit')" @click="openEditModal(record)"><template #icon><EditOutlined /></template></a-button></a-tooltip><a-tooltip :title="t('delete')"><a-button type="text" shape="circle" danger :aria-label="t('delete')" @click="openDeleteModal(record)"><template #icon><DeleteOutlined /></template></a-button></a-tooltip></div></template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="settings" :tab="t('settingsTab')">
          <div class="settings-layout settings-layout-wide">
            <a-card :title="t('displaySettings')" class="settings-card">
              <a-form layout="vertical">
                <div class="settings-form-grid">
                  <a-form-item :label="t('siteTitle')" class="settings-field-wide">
                    <a-input v-model:value="settings.siteTitle" />
                  </a-form-item>
                  <a-form-item :label="t('defaultView')">
                    <a-select v-model:value="settings.defaultView">
                      <a-select-option value="bar">{{ t('card') }}</a-select-option>
                      <a-select-option value="ring">{{ t('ring') }}</a-select-option>
                      <a-select-option value="table">{{ t('table') }}</a-select-option>
                    </a-select>
                  </a-form-item>
                  <a-form-item :label="t('backgroundImage')" class="settings-field-wide">
                    <a-input v-model:value="settings.backgroundImage" placeholder="https://..." addon-after="URL" />
                  </a-form-item>
                  <a-form-item :label="t('customHead')" class="settings-field-wide">
                    <a-textarea v-model:value="settings.customHead" :rows="3" />
                  </a-form-item>
                  <a-form-item :label="t('customScript')" class="settings-field-wide">
                    <a-textarea v-model:value="settings.customScript" :rows="4" />
                  </a-form-item>
                </div>
                <div class="settings-toggle-grid">
                  <div class="setting-switch-row"><span>{{ t('showPrice') }}</span><a-switch v-model:checked="settings.showPrice" /></div>
                  <div class="setting-switch-row"><span>{{ t('showExpiry') }}</span><a-switch v-model:checked="settings.showExpire" /></div>
                  <div class="setting-switch-row"><span>{{ t('showTraffic') }}</span><a-switch v-model:checked="settings.showTraffic" /></div>
                  <div class="setting-switch-row"><span>{{ t('showUpdateTime') }}</span><a-switch v-model:checked="settings.showUpdateTime" /></div>
                  <div class="setting-switch-row"><span>{{ t('allowLongHistory') }}</span><a-switch v-model:checked="settings.showLongHistory" /></div>
                </div>
              </a-form>
            </a-card>

            <a-card :title="t('collectionProbe')" class="settings-card">
              <a-form layout="vertical">
                <div class="settings-form-grid">
                  <a-form-item :label="t('telecomProbe')"><a-input v-model:value="settings.customCt" /></a-form-item>
                  <a-form-item :label="t('unicomProbe')"><a-input v-model:value="settings.customCu" /></a-form-item>
                  <a-form-item :label="t('mobileProbe')"><a-input v-model:value="settings.customCm" /></a-form-item>
                  <a-form-item :label="t('baiduProbe')"><a-input v-model:value="settings.customBd" /></a-form-item>
                </div>
              </a-form>
            </a-card>

            <a-card :title="t('notificationSettings')" class="settings-card settings-card-notification">
              <a-form layout="vertical">
                <a-form-item label="Telegram Bot Token"><a-input-password v-model:value="settings.telegramBotToken" /></a-form-item>
                <a-form-item label="Telegram Chat ID"><a-input-password v-model:value="settings.telegramChatId" /></a-form-item>
                <a-form-item :label="t('offlineDelay')">
                  <a-select v-model:value="settings.offlineNotifyMinutes">
                    <a-select-option :value="0">{{ t('disabled') }}</a-select-option>
                    <a-select-option v-for="minute in [2, 3, 5, 10, 15]" :key="minute" :value="minute">{{ t('minutes', { count: minute }) }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item :label="t('expiryReminder')">
                  <div class="inline-switch"><a-switch v-model:checked="settings.expiryReminder" /><span>{{ t('expiryReminderHint') }}</span></div>
                </a-form-item>
                <div class="settings-card-action">
                  <a-button :loading="testingNotification" :disabled="settingsApiIndex !== apiIndex" @click="testNotification"><template #icon><SendOutlined /></template>{{ t('sendTestNotification') }}</a-button>
                </div>
              </a-form>
            </a-card>

            <a-card :title="t('securitySettings')" class="settings-card">
              <a-form layout="vertical">
                <div class="settings-form-grid">
                  <a-form-item :label="t('adminUsername')"><a-input v-model:value="settings.adminUsername" /></a-form-item>
                  <a-form-item :label="t('publicMonitor')"><a-switch v-model:checked="settings.isPublic" /></a-form-item>
                  <a-form-item :label="t('globalTurnstile')"><a-switch v-model:checked="settings.turnstileEnabled" /></a-form-item>
                  <a-form-item :label="t('loginTurnstile')"><a-switch v-model:checked="settings.turnstileLoginEnabled" /></a-form-item>
                  <a-form-item label="Turnstile Site Key"><a-input v-model:value="settings.turnstileSiteKey" /></a-form-item>
                  <a-form-item label="Turnstile Secret"><a-input-password v-model:value="settings.turnstileSecret" /></a-form-item>
                  <a-form-item label="JWT Secret" class="settings-field-wide"><a-input-password v-model:value="settings.jwtSecret" /></a-form-item>
                  <a-form-item :label="t('staticCsp')"><a-input v-model:value="settings.cspStatic" placeholder="https://static.example.com" /></a-form-item>
                  <a-form-item :label="t('apiCsp')"><a-input v-model:value="settings.cspApi" placeholder="https://api.example.com" /></a-form-item>
                </div>
                <a-divider />
                <div class="settings-form-grid">
                  <a-form-item :label="t('newAdminPassword')"><a-input-password v-model:value="settings.adminPassword" /></a-form-item>
                  <a-form-item :label="t('confirmPassword')" :validate-status="passwordError ? 'error' : ''" :help="passwordError"><a-input-password v-model:value="settings.confirmPassword" /></a-form-item>
                </div>
              </a-form>
            </a-card>

            <a-card :title="t('cloudflareQuota')" class="settings-card settings-card-span">
              <a-form layout="vertical" class="settings-cloudflare-form">
                <a-form-item label="Cloudflare Account ID"><a-input v-model:value="settings.cloudflareAccountId" /></a-form-item>
                <a-form-item label="Cloudflare API Token"><a-input-password v-model:value="settings.cloudflareApiToken" /></a-form-item>
                <div class="settings-card-action">
                  <a-button :loading="queryingQuota" :disabled="settingsApiIndex !== apiIndex" @click="queryQuota"><template #icon><LineChartOutlined /></template>{{ t('queryQuota') }}</a-button>
                </div>
              </a-form>
            </a-card>
          </div>
          <div class="settings-save-row"><span v-if="settingsSaved" class="save-status"><CheckCircleOutlined /> {{ t('saved') }}</span><a-button type="primary" :loading="savingSettings" :disabled="Boolean(passwordError) || settingsApiIndex !== apiIndex" @click="saveSettings"><template #icon><SaveOutlined /></template>{{ t('saveSettings') }}</a-button></div>
        </a-tab-pane>

        <a-tab-pane key="database" :tab="t('databaseTab')">
          <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importServers" />
          <div class="database-grid">
            <a-card :title="t('exportServers')"><p>{{ t('exportDescription') }}</p><a-button type="primary" @click="exportServers"><template #icon><ExportOutlined /></template>{{ t('exportConfig') }}</a-button></a-card>
            <a-card :title="t('importServers')"><p>{{ t('importDescription') }}</p><a-button @click="fileInput?.click()"><template #icon><ImportOutlined /></template>{{ t('selectBackup') }}</a-button></a-card>
            <a-card :title="t('upgradeDatabase')"><p>{{ t('upgradeDescription') }}</p><a-popconfirm :title="t('confirmUpgrade')" :ok-text="t('upgrade')" :cancel-text="t('cancel')" @confirm="runDatabaseAction('upgrade')"><a-button type="primary"><template #icon><DatabaseOutlined /></template>{{ t('upgradeDatabase') }}</a-button></a-popconfirm></a-card>
            <a-card :title="t('clearHistory')"><p>{{ t('clearHistoryDescription') }}</p><a-popconfirm :title="t('confirmClearHistory')" :ok-text="t('clear')" :cancel-text="t('cancel')" @confirm="runDatabaseAction('clear')"><a-button danger><template #icon><DeleteOutlined /></template>{{ t('clearHistory') }}</a-button></a-popconfirm></a-card>
          </div>
        </a-tab-pane>
      </a-tabs>
    </main>

    <ServerEditorModal v-model:open="serverModalOpen" :server="editingServer" :ping-defaults="pingDefaults" @save="saveServer" />
    <CommandPreviewModal v-model:open="commandModalOpen" :server="commandServer" :api-base="apiEndpoint" :api-secret="apiSecret" @edit="editFromCommand" />
    <ServerDeleteModal v-model:open="deleteModalOpen" :server="deletingServer" :api-base="apiEndpoint" @confirm="removeServer" />

    <a-modal v-model:open="quotaModalOpen" :title="t('quotaTitle')" :footer="null">
      <div class="quota-list"><div v-for="item in quotaItems" :key="item.label"><span><strong>{{ item.label }}</strong><small>{{ item.used }} / {{ item.limit }}</small></span><a-progress :percent="item.percent" :status="item.percent > 80 ? 'exception' : 'normal'" /></div></div>
    </a-modal>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AAlert from 'ant-design-vue/es/alert'
import AButton from 'ant-design-vue/es/button'
import ABadge from 'ant-design-vue/es/badge'
import ACard from 'ant-design-vue/es/card'
import ADivider from 'ant-design-vue/es/divider'
import AForm, { FormItem as AFormItem } from 'ant-design-vue/es/form'
import AInput, { InputPassword as AInputPassword, Textarea as ATextarea } from 'ant-design-vue/es/input'
import AModal from 'ant-design-vue/es/modal'
import APopconfirm from 'ant-design-vue/es/popconfirm'
import AProgress from 'ant-design-vue/es/progress'
import ASelect, { SelectOption as ASelectOption } from 'ant-design-vue/es/select'
import ASwitch from 'ant-design-vue/es/switch'
import ATable from 'ant-design-vue/es/table'
import ATag from 'ant-design-vue/es/tag'
import ATabs, { TabPane as ATabPane } from 'ant-design-vue/es/tabs'
import ATooltip from 'ant-design-vue/es/tooltip'
import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, CodeOutlined, DatabaseOutlined, DeleteOutlined, EditOutlined, ExportOutlined, HomeOutlined, ImportOutlined, LineChartOutlined, LogoutOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons-vue'

import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'
import CommandPreviewModal from '../components/CommandPreviewModal.vue'
import FleetSummary from '../components/FleetSummary.vue'
import ServerDeleteModal from '../components/ServerDeleteModal.vue'
import ServerEditorModal from '../components/ServerEditorModal.vue'
import { createDefaultSettings, type GlobalSettings, type ManagedServer } from '../data/admin'
import {
  applyAdminSettings,
  runAdminAction,
  toAdminServerPayload,
  toAdminSettingsPayload,
  toManagedServer,
  type AdminListResponse,
  type AdminOperationResponse,
  type AdminSettingsResponse,
  type AdminUsageResponse,
} from '../utils/admin-api'
import { clearHistory, fetchConfig, logout as apiLogout, upgradeDatabase } from '../utils/api'
import { normalizeApiIndex } from '../utils/auth'
import { getApiBases } from '../utils/config'
import { BILLING_CYCLES } from '../utils/server'
import { currentLanguage, t } from '../utils/i18n'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const activeTab = ref('servers')
const route = useRoute()
const router = useRouter()
const apiBases = getApiBases()
const apiEndpoints = computed(() => apiBases.map((value, index) => ({ label: apiBases.length > 1 ? t('siteNumber', { number: index + 1 }) : t('currentSite'), value })))
const initialApiIndex = normalizeApiIndex(route.query.api ?? route.query.apiIndex)
const apiEndpoint = ref(apiEndpoints.value[initialApiIndex]?.value ?? apiEndpoints.value[0]!.value)
const apiIndex = computed(() => Math.max(0, apiBases.indexOf(apiEndpoint.value)))
const apiSecret = ref('')
const settingsApiIndex = ref<number | null>(null)
const search = ref('')
const statusFilter = ref('all')
const refreshing = ref(false)
const selectedIds = ref<string[]>([])
const serverModalOpen = ref(false)
const commandModalOpen = ref(false)
const deleteModalOpen = ref(false)
const quotaModalOpen = ref(false)
const editingServer = ref<ManagedServer | null>(null)
const commandServer = ref<ManagedServer | null>(null)
const deletingServer = ref<ManagedServer | null>(null)
const servers = ref<ManagedServer[]>([])
const apiStats = ref<AdminListResponse['stats']>({})
const latestAgentVersion = ref('')
const settings = reactive<GlobalSettings>(createDefaultSettings())
const settingsSaved = ref(false)
const savingSettings = ref(false)
const testingNotification = ref(false)
const queryingQuota = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const feedback = ref<{ type: 'success' | 'info' | 'warning' | 'error'; message: string } | null>(null)
let adminLoadRun = 0

const columns = computed(() => [
  { title: '↕', key: 'sort', width: 72, fixed: 'left' as const }, { title: t('server'), key: 'name', width: 210, fixed: 'left' as const }, { title: t('group'), key: 'group', width: 100 }, { title: t('tags'), key: 'tags', width: 170 }, { title: t('note'), key: 'note', width: 150 }, { title: t('billing'), key: 'billing', width: 115 }, { title: t('expiryDate'), key: 'expire', width: 125 }, { title: t('monthlyTraffic'), key: 'traffic', width: 100 }, { title: t('agent'), key: 'version', width: 90 }, { title: t('status'), key: 'status', width: 90 }, { title: t('public'), key: 'enabled', width: 70 }, { title: t('actions'), key: 'actions', width: 140, fixed: 'right' as const },
])

const stats = computed(() => {
  const online = servers.value.filter((server) => server.status === 'online').length
  const averageCpu = Math.round(servers.value.filter((server) => server.status === 'online').reduce((total, server) => total + server.cpu, 0) / Math.max(online, 1))
  return {
    total: Number(apiStats.value?.total ?? servers.value.length),
    online: Number(apiStats.value?.online ?? online),
    offline: Number(apiStats.value?.offline ?? servers.value.length - online),
    averageCpu: Number(apiStats.value?.avg_cpu ?? averageCpu),
    downloadRate: Number(apiStats.value?.total_net_in || 0) / 1024 ** 2,
    uploadRate: Number(apiStats.value?.total_net_out || 0) / 1024 ** 2,
  }
})
const filteredServers = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return servers.value.filter((server) => {
    const matchesStatus = statusFilter.value === 'all' || server.status === statusFilter.value || (statusFilter.value === 'hidden' && server.isHidden)
    const matchesSearch = !keyword || `${server.name} ${server.ip} ${server.group} ${server.tags.join(' ')} ${server.note}`.toLowerCase().includes(keyword)
    return matchesStatus && matchesSearch
  })
})
const rowSelection = computed(() => ({ selectedRowKeys: selectedIds.value, onChange: (keys: Array<string | number>) => { selectedIds.value = keys.map(String) } }))
const passwordError = computed(() => settings.adminPassword && settings.adminPassword !== settings.confirmPassword ? t('passwordMismatch') : '')
const quotaItems = ref<Array<{ label: string; used: string; limit: string; percent: number }>>([])
const pingDefaults = computed(() => ({
  customCt: settings.customCt,
  customCu: settings.customCu,
  customCm: settings.customCm,
  customBd: settings.customBd,
}))

const setFeedback = (type: 'success' | 'info' | 'warning' | 'error', message: string) => {
  feedback.value = { type, message }
}

async function loadServers(requestedIndex = apiIndex.value, requestedRun = adminLoadRun) {
  const data = await runAdminAction<AdminListResponse>('list', {}, requestedIndex)
  if (requestedIndex !== apiIndex.value || requestedRun !== adminLoadRun) return
  servers.value = (data.servers || []).map((server) => toManagedServer(server))
  apiStats.value = data.stats || {}
  selectedIds.value = selectedIds.value.filter((id) => servers.value.some((server) => server.id === id))
}

async function loadSettings(requestedIndex = apiIndex.value, requestedRun = adminLoadRun) {
  const data = await runAdminAction<AdminSettingsResponse>('get_settings', {}, requestedIndex)
  if (requestedIndex !== apiIndex.value || requestedRun !== adminLoadRun) return
  if (!data.settings) throw new Error(t('settingsMissing'))
  applyAdminSettings(settings, data.settings)
  apiSecret.value = String(data.api_secret || '')
  settingsApiIndex.value = requestedIndex
}

async function loadLatestAgentVersion(requestedIndex = apiIndex.value, requestedRun = adminLoadRun) {
  const config = await fetchConfig(requestedIndex)
  if (requestedIndex === apiIndex.value && requestedRun === adminLoadRun) latestAgentVersion.value = String(config?.last_agent_version || '')
}

async function loadAdmin() {
  const currentRun = ++adminLoadRun
  const requestedIndex = apiIndex.value
  refreshing.value = true
  feedback.value = null
  try {
    await Promise.all([
      loadServers(requestedIndex, currentRun),
      loadSettings(requestedIndex, currentRun),
      loadLatestAgentVersion(requestedIndex, currentRun),
    ])
  } catch (error) {
    if (currentRun === adminLoadRun) setFeedback('error', error instanceof Error ? error.message : t('adminLoadFailed'))
  } finally {
    if (currentRun === adminLoadRun) refreshing.value = false
  }
}

function openCreateModal() {
  if (settingsApiIndex.value !== apiIndex.value) return
  editingServer.value = null
  serverModalOpen.value = true
}
function adminDetailHref(id: string) { return `#/server/${encodeURIComponent(id)}?api=${apiIndex.value}` }
function openEditModal(server: ManagedServer | Record<string, unknown>) { editingServer.value = server as ManagedServer; serverModalOpen.value = true }
function openCommandModal(server: ManagedServer | Record<string, unknown>) {
  if (settingsApiIndex.value !== apiIndex.value) return
  const value = server as ManagedServer
  commandServer.value = {
    ...value,
    customCt: value.customCt || settings.customCt,
    customCu: value.customCu || settings.customCu,
    customCm: value.customCm || settings.customCm,
    customBd: value.customBd || settings.customBd,
  }
  commandModalOpen.value = true
}
function openDeleteModal(server: ManagedServer | Record<string, unknown>) { deletingServer.value = server as ManagedServer; deleteModalOpen.value = true }
function editFromCommand(server: ManagedServer) { commandModalOpen.value = false; openEditModal(server) }
async function saveServer(server: ManagedServer) {
  const requestedIndex = apiIndex.value
  let saved = server
  try {
    const existing = !server.id.startsWith('draft-') || servers.value.some((item) => item.id === server.id)
    if (!existing) {
      const added = await runAdminAction<AdminOperationResponse>('add', { name: server.name, server_group: server.group, region: server.region }, requestedIndex)
      if (!added.id) throw new Error(t('serverIdMissing'))
      saved = { ...server, id: added.id }
    }
    await runAdminAction('edit', toAdminServerPayload(saved), requestedIndex)
    if (requestedIndex !== apiIndex.value) return
    await loadServers()
    setFeedback('success', t('serverSaved', { name: saved.name }))
  } catch (error) {
    if (requestedIndex !== apiIndex.value) return
    editingServer.value = saved
    serverModalOpen.value = true
    setFeedback('error', error instanceof Error ? error.message : t('serverSaveFailed'))
  }
}

async function removeServer(id: string) {
  const target = servers.value.find((server) => server.id === id)
  try {
    await runAdminAction('delete', { id }, apiIndex.value)
    deleteModalOpen.value = false
    await loadServers()
    setFeedback('success', t('serverDeleted', { name: target?.name ?? id }))
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : t('deleteFailed'))
  }
}

async function batchDelete() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  try {
    await runAdminAction('batch_delete', { ids }, apiIndex.value)
    selectedIds.value = []
    await loadServers()
    setFeedback('success', t('batchDeleted', { count: ids.length }))
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : t('batchDeleteFailed'))
  }
}

async function moveServer(id: string, offset: number) {
  const visibleIndex = filteredServers.value.findIndex((server) => server.id === id)
  const neighbor = filteredServers.value[visibleIndex + offset]
  const index = servers.value.findIndex((server) => server.id === id)
  const next = neighbor ? servers.value.findIndex((server) => server.id === neighbor.id) : -1
  if (index < 0 || next < 0) return
  const copy = [...servers.value]
  ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  servers.value = copy
  try {
    await runAdminAction('save_order', { orders: copy.map((server) => server.id) }, apiIndex.value)
  } catch (error) {
    await loadServers()
    setFeedback('error', error instanceof Error ? error.message : t('sortSaveFailed'))
  }
}

async function toggleServerEnabled(value: ManagedServer | Record<string, unknown>, enabled: boolean) {
  const server = value as ManagedServer
  const updated = { ...server, enabled, isHidden: !enabled }
  try {
    await runAdminAction('edit', toAdminServerPayload(updated), apiIndex.value)
    Object.assign(server, updated)
    setFeedback('success', t('serverVisibilityChanged', { name: server.name, state: t(enabled ? 'shown' : 'hiddenState') }))
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : t('statusUpdateFailed'))
  }
}

async function refreshServers() {
  const requestedIndex = apiIndex.value
  const requestedRun = adminLoadRun
  refreshing.value = true
  try {
    await loadServers(requestedIndex, requestedRun)
    if (requestedIndex !== apiIndex.value || requestedRun !== adminLoadRun) return
    setFeedback('info', t('monitorRefreshed'))
  } catch (error) {
    if (requestedIndex !== apiIndex.value || requestedRun !== adminLoadRun) return
    setFeedback('error', error instanceof Error ? error.message : t('refreshFailed'))
  } finally {
    if (requestedIndex === apiIndex.value && requestedRun === adminLoadRun) refreshing.value = false
  }
}
async function copyNote(note: string) { if (!note) return; await navigator.clipboard?.writeText(note); feedback.value = { type: 'success', message: t('noteCopied') } }
function billingLabel(value: string) {
  const option = BILLING_CYCLES.find((item) => item.value === value)
  return currentLanguage.value === 'zh' ? option?.shortLabelZh ?? '月' : option?.shortLabelEn ?? 'M'
}
function normalizeVersion(value: unknown) { return String(value || '').trim().replace(/^v/i, '') }
function isAgentOutdated(value: unknown) {
  return Boolean(normalizeVersion(value) && normalizeVersion(latestAgentVersion.value) && normalizeVersion(value) !== normalizeVersion(latestAgentVersion.value))
}
function agentVersionClass(value: unknown) { return isAgentOutdated(value) ? 'text-danger' : '' }
function agentVersionTitle(value: unknown) {
  if (!latestAgentVersion.value) return ''
  return isAgentOutdated(value) ? t('agentOutdated', { version: latestAgentVersion.value }) : t('latestAgent', { version: latestAgentVersion.value })
}
function isExpiring(value: string) { return Boolean(value) && new Date(value).getTime() - Date.now() < 90 * 86_400_000 }
async function saveSettings() {
  if (passwordError.value || savingSettings.value || settingsApiIndex.value !== apiIndex.value) return
  if (!settings.adminUsername.trim()) return setFeedback('error', t('usernameRequired'))
  if (settings.jwtSecret && settings.jwtSecret.length < 32) return setFeedback('error', t('jwtTooShort'))
  if ((settings.turnstileEnabled || settings.turnstileLoginEnabled) && (!settings.turnstileSiteKey || !settings.turnstileSecret)) {
    return setFeedback('error', t('turnstileFieldsRequired'))
  }
  if ((settings.offlineNotifyMinutes > 0 || settings.expiryReminder) && !settings.telegramBotToken.trim()) {
    return setFeedback('error', t('notificationTargetRequired'))
  }
  savingSettings.value = true
  settingsSaved.value = false
  try {
    await runAdminAction('save_settings', { settings: toAdminSettingsPayload(settings) }, apiIndex.value)
    settings.adminPassword = ''
    settings.confirmPassword = ''
    settings.jwtSecret = ''
    settingsSaved.value = true
    setFeedback('success', t('settingsSaved'))
    await loadSettings()
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : t('settingsSaveFailed'))
  } finally {
    savingSettings.value = false
  }
}

async function testNotification() {
  if (settingsApiIndex.value !== apiIndex.value) return
  testingNotification.value = true
  try {
    await runAdminAction('send_test_notification', { tg_bot_token: settings.telegramBotToken, tg_chat_id: settings.telegramChatId }, apiIndex.value)
    setFeedback('success', t('notificationSent'))
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : t('notificationFailed'))
  } finally {
    testingNotification.value = false
  }
}

async function queryQuota() {
  if (settingsApiIndex.value !== apiIndex.value) return
  queryingQuota.value = true
  try {
    const data = await runAdminAction<AdminUsageResponse>('d1_usage', {
      cloudflare_account_id: settings.cloudflareAccountId,
      cloudflare_token: settings.cloudflareApiToken,
    }, apiIndex.value)
    const today = data.usage?.today || {}
    const last24 = data.usage?.last24Hours || {}
    quotaItems.value = [
      { label: t('quotaReadToday'), used: Number(today.rowsRead || 0).toLocaleString(), limit: t('quotaUnavailable'), percent: 0 },
      { label: t('quotaWriteToday'), used: Number(today.rowsWritten || 0).toLocaleString(), limit: t('quotaUnavailable'), percent: 0 },
      { label: t('quotaWorkersToday'), used: Number(today.workersRequests || 0).toLocaleString(), limit: t('quotaUnavailable'), percent: 0 },
      { label: t('quotaRead24h'), used: Number(last24.rowsRead || 0).toLocaleString(), limit: t('quotaUnavailable'), percent: 0 },
    ]
    quotaModalOpen.value = true
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : t('quotaFailed'))
  } finally {
    queryingQuota.value = false
  }
}

async function exportServers() {
  try {
    const data = await runAdminAction<AdminOperationResponse & { servers?: Record<string, unknown>[] }>('export_servers', {}, apiIndex.value)
    const exported = data.servers || []
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `edgeprobe-servers-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    setFeedback('success', t('exportedServers', { count: exported.length }))
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : t('exportFailed'))
  }
}
async function importServers(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const requestedIndex = apiIndex.value
  const requestedRun = adminLoadRun
  try {
    const imported: unknown = JSON.parse(await file.text())
    if (requestedIndex !== apiIndex.value || requestedRun !== adminLoadRun) return
    if (!Array.isArray(imported)) throw new Error(t('invalidBackup'))
    const result = await runAdminAction<AdminOperationResponse>('import_servers', { servers: imported }, requestedIndex)
    if (requestedIndex !== apiIndex.value || requestedRun !== adminLoadRun) return
    await loadServers()
    setFeedback('success', String(result.message || t('importedServers', { count: imported.length })))
  } catch (error) {
    if (requestedIndex !== apiIndex.value || requestedRun !== adminLoadRun) return
    feedback.value = { type: 'error', message: error instanceof Error ? error.message : t('importFailed') }
  } finally {
    input.value = ''
  }
}
async function runDatabaseAction(action: 'upgrade' | 'clear') {
  const result = action === 'upgrade' ? await upgradeDatabase(apiIndex.value) : await clearHistory(apiIndex.value)
  setFeedback(result.success ? 'success' : 'error', result.success
    ? action === 'upgrade' ? t('databaseUpgraded') : t('historyCleared')
    : result.error || t('databaseFailed'))
}

function logout() {
  apiLogout(apiIndex.value)
  void router.replace({ name: 'login', query: { api: String(apiIndex.value) } })
}

watch(apiEndpoint, async (value) => {
  const nextIndex = Math.max(0, apiBases.indexOf(value))
  if (String(route.query.api ?? '') === String(nextIndex)) return
  adminLoadRun += 1
  refreshing.value = true
  servers.value = []
  apiStats.value = {}
  latestAgentVersion.value = ''
  selectedIds.value = []
  settingsApiIndex.value = null
  Object.assign(settings, createDefaultSettings())
  apiSecret.value = ''
  serverModalOpen.value = false
  commandModalOpen.value = false
  deleteModalOpen.value = false
  quotaModalOpen.value = false
  editingServer.value = null
  commandServer.value = null
  deletingServer.value = null
  await router.replace({ name: 'admin', query: { ...route.query, api: String(nextIndex) } })
})
watch(() => route.query.api, async (value) => {
  const nextIndex = normalizeApiIndex(value)
  const nextEndpoint = apiEndpoints.value[nextIndex]?.value ?? apiEndpoints.value[0]!.value
  if (apiEndpoint.value !== nextEndpoint) apiEndpoint.value = nextEndpoint
  feedback.value = null
  await loadAdmin()
})
onMounted(() => { void loadAdmin() })
</script>
