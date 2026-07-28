<template>
  <div class="admin-page" :class="{ 'is-dark': isDark }">
    <AppHeader subtitle="ADMIN CONSOLE" :is-dark="isDark" @toggle-theme="$emit('toggle-theme')">
      <a-select v-if="apiEndpoints.length > 1" v-model:value="apiEndpoint" class="header-site-select" aria-label="管理站点"><a-select-option v-for="endpoint in apiEndpoints" :key="endpoint.value" :value="endpoint.value">{{ endpoint.label }}</a-select-option></a-select>
      <a-button type="text" href="#/"><template #icon><HomeOutlined /></template>监控页</a-button>
      <template #end><a-button type="text" danger @click="logout"><template #icon><LogoutOutlined /></template>退出</a-button></template>
    </AppHeader>

    <main class="admin-content">
      <FleetSummary
        class="admin-overview-grid"
        :total="stats.total"
        :online="stats.online"
        :offline="stats.offline"
        :average-cpu="stats.averageCpu"
        :download-rate="stats.downloadRate"
        download-total="实时合计"
        :upload-rate="stats.uploadRate"
        upload-total="实时合计"
      />

      <a-alert v-if="feedback" :type="feedback.type" show-icon closable :message="feedback.message" class="admin-feedback" @close="feedback = null" />

      <a-tabs v-model:active-key="activeTab" class="admin-tabs">
        <a-tab-pane key="servers" tab="服务器">
          <div class="admin-toolbar">
            <div class="admin-filters">
              <a-input v-model:value="search" allow-clear placeholder="搜索名称、地址、分组、标签或备注" class="admin-search"><template #prefix><SearchOutlined /></template></a-input>
              <a-select v-model:value="statusFilter" class="status-select"><a-select-option value="all">全部状态</a-select-option><a-select-option value="online">在线</a-select-option><a-select-option value="offline">离线</a-select-option><a-select-option value="hidden">已隐藏</a-select-option></a-select>
            </div>
            <div class="admin-toolbar-actions">
              <a-button v-if="selectedIds.length" danger @click="batchDelete"><template #icon><DeleteOutlined /></template>删除 {{ selectedIds.length }} 项</a-button>
              <a-button :loading="refreshing" @click="refreshServers"><template #icon><ReloadOutlined /></template>刷新</a-button>
              <a-button type="primary" @click="openCreateModal"><template #icon><PlusOutlined /></template>添加服务器</a-button>
            </div>
          </div>

          <a-table class="admin-table" :columns="columns" :data-source="filteredServers" :row-selection="rowSelection" :pagination="{ pageSize: 8, hideOnSinglePage: true }" :scroll="{ x: 1540 }" :loading="refreshing" row-key="id" size="middle">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'sort'"><div class="sort-actions"><a-button type="text" size="small" aria-label="上移" @click="moveServer(record.id, -1)"><template #icon><ArrowUpOutlined /></template></a-button><a-button type="text" size="small" aria-label="下移" @click="moveServer(record.id, 1)"><template #icon><ArrowDownOutlined /></template></a-button></div></template>
              <template v-else-if="column.key === 'name'"><a :href="`#/server/${record.id}`" class="admin-server-name"><img :src="`/flags/${record.region}.svg`" alt="" /><span><strong>{{ record.name }}</strong><small>{{ record.id }}</small></span></a></template>
              <template v-else-if="column.key === 'group'"><a-tag>{{ record.group }}</a-tag></template>
              <template v-else-if="column.key === 'tags'"><span class="compact-tags"><a-tag v-for="tag in record.tags" :key="tag" color="blue">{{ tag }}</a-tag></span></template>
              <template v-else-if="column.key === 'note'"><a-tooltip title="双击复制"><span class="note-cell" @dblclick="copyNote(record.note)">{{ record.note || '-' }}</span></a-tooltip></template>
              <template v-else-if="column.key === 'billing'"><span>{{ record.currency }}{{ record.price.toFixed(2) }}/{{ billingLabel(record.billingCycle) }}</span></template>
              <template v-else-if="column.key === 'expire'"><span :class="{ 'text-danger': isExpiring(record.expireDate) }">{{ record.expireDate || '-' }}</span><small v-if="record.autoRenewal" class="cell-subtext">自动续费</small></template>
              <template v-else-if="column.key === 'traffic'">{{ record.trafficLimit ? `${record.trafficLimit} GB` : '不限' }}</template>
              <template v-else-if="column.key === 'version'"><span>{{ record.agentVersion }}</span></template>
              <template v-else-if="column.key === 'status'"><a-badge :status="record.status === 'online' ? 'success' : 'error'" :text="record.status === 'online' ? '在线' : '离线'" /></template>
              <template v-else-if="column.key === 'enabled'"><a-switch :checked="record.enabled" size="small" @change="toggleServerEnabled(record, Boolean($event))" /></template>
              <template v-else-if="column.key === 'actions'"><div class="table-actions"><a-tooltip title="安装命令"><a-button type="text" shape="circle" aria-label="安装命令" @click="openCommandModal(record)"><template #icon><CodeOutlined /></template></a-button></a-tooltip><a-tooltip title="编辑"><a-button type="text" shape="circle" aria-label="编辑" @click="openEditModal(record)"><template #icon><EditOutlined /></template></a-button></a-tooltip><a-tooltip title="删除"><a-button type="text" shape="circle" danger aria-label="删除" @click="openDeleteModal(record)"><template #icon><DeleteOutlined /></template></a-button></a-tooltip></div></template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="settings" tab="全局设置">
          <div class="settings-layout settings-layout-wide">
            <a-card title="展示设置" class="settings-card">
              <a-form layout="vertical">
                <div class="settings-form-grid">
                  <a-form-item label="站点标题" class="settings-field-wide">
                    <a-input v-model:value="settings.siteTitle" />
                  </a-form-item>
                  <a-form-item label="默认视图">
                    <a-select v-model:value="settings.defaultView">
                      <a-select-option value="bar">卡片</a-select-option>
                      <a-select-option value="ring">环形</a-select-option>
                      <a-select-option value="table">表格</a-select-option>
                    </a-select>
                  </a-form-item>
                  <a-form-item label="默认语言">
                    <a-select v-model:value="settings.language">
                      <a-select-option value="zh">简体中文</a-select-option>
                      <a-select-option value="en">English</a-select-option>
                    </a-select>
                  </a-form-item>
                  <a-form-item label="背景图片" class="settings-field-wide">
                    <a-input v-model:value="settings.backgroundImage" placeholder="https://..." addon-after="URL" />
                  </a-form-item>
                </div>
                <div class="settings-toggle-grid">
                  <div class="setting-switch-row"><span>显示价格</span><a-switch v-model:checked="settings.showPrice" /></div>
                  <div class="setting-switch-row"><span>显示到期时间</span><a-switch v-model:checked="settings.showExpire" /></div>
                  <div class="setting-switch-row"><span>显示流量信息</span><a-switch v-model:checked="settings.showTraffic" /></div>
                  <div class="setting-switch-row"><span>显示更新时间</span><a-switch v-model:checked="settings.showUpdateTime" /></div>
                  <div class="setting-switch-row"><span>允许长期历史</span><a-switch v-model:checked="settings.showLongHistory" /></div>
                </div>
              </a-form>
            </a-card>

            <a-card title="采集与探测" class="settings-card">
              <a-form layout="vertical">
                <div class="settings-form-grid">
                  <a-form-item label="电信探测点"><a-input v-model:value="settings.customCt" /></a-form-item>
                  <a-form-item label="联通探测点"><a-input v-model:value="settings.customCu" /></a-form-item>
                  <a-form-item label="移动探测点"><a-input v-model:value="settings.customCm" /></a-form-item>
                  <a-form-item label="百度探测点"><a-input v-model:value="settings.customBd" /></a-form-item>
                </div>
              </a-form>
            </a-card>

            <a-card title="通知设置" class="settings-card settings-card-notification">
              <a-form layout="vertical">
                <a-form-item label="Telegram Bot Token"><a-input-password v-model:value="settings.telegramBotToken" /></a-form-item>
                <a-form-item label="Telegram Chat ID"><a-input-password v-model:value="settings.telegramChatId" /></a-form-item>
                <a-form-item label="离线通知延迟">
                  <a-select v-model:value="settings.offlineNotifyMinutes">
                    <a-select-option :value="0">关闭</a-select-option>
                    <a-select-option v-for="minute in [2, 3, 5, 10, 15]" :key="minute" :value="minute">{{ minute }} 分钟</a-select-option>
                  </a-select>
                </a-form-item>
                <div class="settings-card-action">
                  <a-button :loading="testingNotification" @click="testNotification"><template #icon><SendOutlined /></template>发送测试通知</a-button>
                </div>
              </a-form>
            </a-card>

            <a-card title="安全设置" class="settings-card">
              <a-form layout="vertical">
                <div class="settings-form-grid">
                  <a-form-item label="管理员用户名"><a-input v-model:value="settings.adminUsername" /></a-form-item>
                  <a-form-item label="公开监控页"><a-switch v-model:checked="settings.isPublic" /></a-form-item>
                  <a-form-item label="全站 Turnstile"><a-switch v-model:checked="settings.turnstileEnabled" /></a-form-item>
                  <a-form-item label="登录 Turnstile"><a-switch v-model:checked="settings.turnstileLoginEnabled" /></a-form-item>
                  <a-form-item label="Turnstile Site Key"><a-input v-model:value="settings.turnstileSiteKey" /></a-form-item>
                  <a-form-item label="Turnstile Secret"><a-input-password v-model:value="settings.turnstileSecret" /></a-form-item>
                  <a-form-item label="JWT Secret" class="settings-field-wide"><a-input-password v-model:value="settings.jwtSecret" /></a-form-item>
                  <a-form-item label="静态资源 CSP 来源"><a-input v-model:value="settings.cspStatic" placeholder="https://static.example.com" /></a-form-item>
                  <a-form-item label="API CSP 来源"><a-input v-model:value="settings.cspApi" placeholder="https://api.example.com" /></a-form-item>
                </div>
                <a-divider />
                <div class="settings-form-grid">
                  <a-form-item label="新管理员密码"><a-input-password v-model:value="settings.adminPassword" /></a-form-item>
                  <a-form-item label="确认密码" :validate-status="passwordError ? 'error' : ''" :help="passwordError"><a-input-password v-model:value="settings.confirmPassword" /></a-form-item>
                </div>
              </a-form>
            </a-card>

            <a-card title="Cloudflare 与配额" class="settings-card settings-card-span">
              <a-form layout="vertical" class="settings-cloudflare-form">
                <a-form-item label="Cloudflare Account ID"><a-input v-model:value="settings.cloudflareAccountId" /></a-form-item>
                <a-form-item label="Cloudflare API Token"><a-input-password v-model:value="settings.cloudflareApiToken" /></a-form-item>
                <div class="settings-card-action">
                  <a-button :loading="queryingQuota" @click="queryQuota"><template #icon><LineChartOutlined /></template>查询 D1 与 Workers 配额</a-button>
                </div>
              </a-form>
            </a-card>
          </div>
          <div class="settings-save-row"><span v-if="settingsSaved" class="save-status"><CheckCircleOutlined /> 已保存</span><a-button type="primary" :loading="savingSettings" :disabled="Boolean(passwordError)" @click="saveSettings"><template #icon><SaveOutlined /></template>保存设置</a-button></div>
        </a-tab-pane>

        <a-tab-pane key="database" tab="数据库">
          <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importServers" />
          <div class="database-grid">
            <a-card title="导出服务器"><p>生成包含全部服务器配置的 JSON 备份。</p><a-button type="primary" @click="exportServers"><template #icon><ExportOutlined /></template>导出配置</a-button></a-card>
            <a-card title="导入服务器"><p>从 JSON 备份恢复服务器，重复 ID 将被跳过。</p><a-button @click="fileInput?.click()"><template #icon><ImportOutlined /></template>选择备份文件</a-button></a-card>
            <a-card title="升级数据库"><p>检查并应用当前版本需要的数据库结构。</p><a-popconfirm title="确认执行数据库升级？" ok-text="升级" cancel-text="取消" @confirm="runDatabaseAction('upgrade')"><a-button type="primary"><template #icon><DatabaseOutlined /></template>升级数据库</a-button></a-popconfirm></a-card>
            <a-card title="清理历史数据"><p>保留服务器配置，仅删除历史监控记录。</p><a-popconfirm title="确定清理全部历史记录？" ok-text="清理" cancel-text="取消" @confirm="runDatabaseAction('clear')"><a-button danger><template #icon><DeleteOutlined /></template>清理历史</a-button></a-popconfirm></a-card>
          </div>
        </a-tab-pane>
      </a-tabs>
    </main>

    <ServerEditorModal v-model:open="serverModalOpen" :server="editingServer" @save="saveServer" />
    <CommandPreviewModal v-model:open="commandModalOpen" :server="commandServer" :api-base="apiEndpoint" :api-secret="apiSecret" @edit="editFromCommand" />
    <ServerDeleteModal v-model:open="deleteModalOpen" :server="deletingServer" @confirm="removeServer" />

    <a-modal v-model:open="quotaModalOpen" title="D1 与 Workers 配额" :footer="null">
      <div class="quota-list"><div v-for="item in quotaItems" :key="item.label"><span><strong>{{ item.label }}</strong><small>{{ item.used }} / {{ item.limit }}</small></span><a-progress :percent="item.percent" :status="item.percent > 80 ? 'exception' : 'normal'" /></div></div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AAlert from 'ant-design-vue/es/alert'
import AButton from 'ant-design-vue/es/button'
import ABadge from 'ant-design-vue/es/badge'
import ACard from 'ant-design-vue/es/card'
import ADivider from 'ant-design-vue/es/divider'
import AForm, { FormItem as AFormItem } from 'ant-design-vue/es/form'
import AInput, { InputPassword as AInputPassword } from 'ant-design-vue/es/input'
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
import { clearHistory, logout as apiLogout, upgradeDatabase } from '../utils/api'
import { getApiBases } from '../utils/config'
import { BILLING_CYCLES } from '../utils/server'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const activeTab = ref('servers')
const router = useRouter()
const apiBases = getApiBases()
const apiEndpoints = apiBases.map((value, index) => ({ label: apiBases.length > 1 ? `站点 ${index + 1}` : '当前站点', value }))
const apiEndpoint = ref(apiEndpoints[0]!.value)
const apiIndex = computed(() => Math.max(0, apiBases.indexOf(apiEndpoint.value)))
const apiSecret = ref('')
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
const settings = reactive<GlobalSettings>(createDefaultSettings())
const settingsSaved = ref(false)
const savingSettings = ref(false)
const testingNotification = ref(false)
const queryingQuota = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const feedback = ref<{ type: 'success' | 'info' | 'warning' | 'error'; message: string } | null>(null)

const columns = [
  { title: '排序', key: 'sort', width: 72, fixed: 'left' as const }, { title: '服务器', key: 'name', width: 210, fixed: 'left' as const }, { title: '分组', key: 'group', width: 100 }, { title: '标签', key: 'tags', width: 170 }, { title: '备注', key: 'note', width: 150 }, { title: '费用', key: 'billing', width: 115 }, { title: '到期时间', key: 'expire', width: 125 }, { title: '流量', key: 'traffic', width: 100 }, { title: 'Agent', key: 'version', width: 90 }, { title: '状态', key: 'status', width: 90 }, { title: '启用', key: 'enabled', width: 70 }, { title: '操作', key: 'actions', width: 140, fixed: 'right' as const },
]

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
const passwordError = computed(() => settings.adminPassword && settings.adminPassword !== settings.confirmPassword ? '两次输入的密码不一致' : '')
const quotaItems = ref<Array<{ label: string; used: string; limit: string; percent: number }>>([])

const setFeedback = (type: 'success' | 'info' | 'warning' | 'error', message: string) => {
  feedback.value = { type, message }
}

async function loadServers() {
  const data = await runAdminAction<AdminListResponse>('list', {}, apiIndex.value)
  servers.value = (data.servers || []).map((server) => toManagedServer(server))
  apiStats.value = data.stats || {}
  selectedIds.value = selectedIds.value.filter((id) => servers.value.some((server) => server.id === id))
}

async function loadSettings() {
  const data = await runAdminAction<AdminSettingsResponse>('get_settings', {}, apiIndex.value)
  if (data.settings) applyAdminSettings(settings, data.settings)
  apiSecret.value = String(data.api_secret || '')
}

async function loadAdmin() {
  refreshing.value = true
  try {
    await Promise.all([loadServers(), loadSettings()])
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '管理数据加载失败')
  } finally {
    refreshing.value = false
  }
}

function openCreateModal() { editingServer.value = null; serverModalOpen.value = true }
function openEditModal(server: ManagedServer | Record<string, unknown>) { editingServer.value = server as ManagedServer; serverModalOpen.value = true }
function openCommandModal(server: ManagedServer | Record<string, unknown>) { commandServer.value = server as ManagedServer; commandModalOpen.value = true }
function openDeleteModal(server: ManagedServer | Record<string, unknown>) { deletingServer.value = server as ManagedServer; deleteModalOpen.value = true }
function editFromCommand(server: ManagedServer) { commandModalOpen.value = false; openEditModal(server) }
async function saveServer(server: ManagedServer) {
  try {
    const existing = servers.value.some((item) => item.id === server.id)
    let saved = server
    if (!existing) {
      const added = await runAdminAction<AdminOperationResponse>('add', { name: server.name, server_group: server.group, region: server.region }, apiIndex.value)
      if (!added.id) throw new Error('后端未返回新服务器 ID')
      saved = { ...server, id: added.id }
    }
    await runAdminAction('edit', toAdminServerPayload(saved), apiIndex.value)
    await loadServers()
    setFeedback('success', `${saved.name} 已保存`)
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '服务器保存失败')
  }
}

async function removeServer(id: string) {
  const target = servers.value.find((server) => server.id === id)
  try {
    await runAdminAction('delete', { id }, apiIndex.value)
    deleteModalOpen.value = false
    await loadServers()
    setFeedback('success', `${target?.name ?? id} 已删除`)
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '删除失败')
  }
}

async function batchDelete() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  try {
    await runAdminAction('batch_delete', { ids }, apiIndex.value)
    selectedIds.value = []
    await loadServers()
    setFeedback('success', `已删除 ${ids.length} 台服务器`)
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '批量删除失败')
  }
}

async function moveServer(id: string, offset: number) {
  const index = servers.value.findIndex((server) => server.id === id)
  const next = index + offset
  if (index < 0 || next < 0 || next >= servers.value.length) return
  const copy = [...servers.value]
  ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  servers.value = copy
  try {
    await runAdminAction('save_order', { orders: copy.map((server) => server.id) }, apiIndex.value)
  } catch (error) {
    await loadServers()
    setFeedback('error', error instanceof Error ? error.message : '排序保存失败')
  }
}

async function toggleServerEnabled(value: ManagedServer | Record<string, unknown>, enabled: boolean) {
  const server = value as ManagedServer
  const updated = { ...server, enabled, isHidden: !enabled }
  try {
    await runAdminAction('edit', toAdminServerPayload(updated), apiIndex.value)
    Object.assign(server, updated)
    setFeedback('success', `${server.name} 已${enabled ? '显示' : '隐藏'}`)
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '状态更新失败')
  }
}

async function refreshServers() {
  refreshing.value = true
  try {
    await loadServers()
    setFeedback('info', '监控数据已刷新')
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '刷新失败')
  } finally {
    refreshing.value = false
  }
}
async function copyNote(note: string) { if (!note) return; await navigator.clipboard?.writeText(note); feedback.value = { type: 'success', message: '备注已复制' } }
function billingLabel(value: string) { return BILLING_CYCLES.find((item) => item.value === value)?.shortLabelZh ?? '月' }
function isExpiring(value: string) { return Boolean(value) && new Date(value).getTime() - Date.now() < 90 * 86_400_000 }
async function saveSettings() {
  if (passwordError.value || savingSettings.value) return
  if (!settings.adminUsername.trim()) return setFeedback('error', '管理员用户名不能为空')
  if (settings.jwtSecret && settings.jwtSecret.length < 32) return setFeedback('error', 'JWT Secret 至少需要 32 个字符')
  if ((settings.turnstileEnabled || settings.turnstileLoginEnabled) && (!settings.turnstileSiteKey || !settings.turnstileSecret)) {
    return setFeedback('error', '启用 Turnstile 时必须填写 Site Key 和 Secret')
  }
  savingSettings.value = true
  settingsSaved.value = false
  try {
    await runAdminAction('save_settings', { settings: toAdminSettingsPayload(settings) }, apiIndex.value)
    settings.adminPassword = ''
    settings.confirmPassword = ''
    settings.jwtSecret = ''
    settingsSaved.value = true
    setFeedback('success', '全局设置已保存')
    await loadSettings()
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '设置保存失败')
  } finally {
    savingSettings.value = false
  }
}

async function testNotification() {
  testingNotification.value = true
  try {
    await runAdminAction('send_test_notification', { tg_bot_token: settings.telegramBotToken, tg_chat_id: settings.telegramChatId }, apiIndex.value)
    setFeedback('success', '测试通知已发送')
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '测试通知发送失败')
  } finally {
    testingNotification.value = false
  }
}

async function queryQuota() {
  queryingQuota.value = true
  try {
    const data = await runAdminAction<AdminUsageResponse>('d1_usage', {
      cloudflare_account_id: settings.cloudflareAccountId,
      cloudflare_token: settings.cloudflareApiToken,
    }, apiIndex.value)
    const today = data.usage?.today || {}
    const last24 = data.usage?.last24Hours || {}
    quotaItems.value = [
      { label: '今日 D1 读取行数', used: Number(today.rowsRead || 0).toLocaleString(), limit: 'API 未返回限额', percent: 0 },
      { label: '今日 D1 写入行数', used: Number(today.rowsWritten || 0).toLocaleString(), limit: 'API 未返回限额', percent: 0 },
      { label: '今日 Workers 请求', used: Number(today.workersRequests || 0).toLocaleString(), limit: 'API 未返回限额', percent: 0 },
      { label: '最近 24 小时 D1 读取', used: Number(last24.rowsRead || 0).toLocaleString(), limit: 'API 未返回限额', percent: 0 },
    ]
    quotaModalOpen.value = true
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '配额查询失败')
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
    setFeedback('success', `已导出 ${exported.length} 台服务器`)
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : '导出失败')
  }
}
async function importServers(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const imported: unknown = JSON.parse(await file.text())
    if (!Array.isArray(imported)) throw new Error('备份文件必须是服务器数组')
    const result = await runAdminAction<AdminOperationResponse>('import_servers', { servers: imported }, apiIndex.value)
    await loadServers()
    setFeedback('success', String(result.message || `已处理 ${imported.length} 台服务器`))
  } catch (error) {
    feedback.value = { type: 'error', message: error instanceof Error ? error.message : '导入失败' }
  } finally {
    input.value = ''
  }
}
async function runDatabaseAction(action: 'upgrade' | 'clear') {
  const result = action === 'upgrade' ? await upgradeDatabase(apiIndex.value) : await clearHistory(apiIndex.value)
  setFeedback(result.success ? 'success' : 'error', result.success
    ? action === 'upgrade' ? '数据库升级完成' : '历史监控记录已清理'
    : result.error || '数据库操作失败')
}

function logout() {
  apiLogout()
  void router.replace('/admin')
}

watch(apiEndpoint, () => { void loadAdmin() })
onMounted(() => { void loadAdmin() })
</script>
