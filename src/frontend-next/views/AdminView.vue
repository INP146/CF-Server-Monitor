<template>
  <div class="admin-page" :class="{ 'is-dark': isDark }">
    <header class="admin-header">
      <div class="admin-header-inner">
        <div class="topbar-brand">
          <span class="brand-mark"><img src="/cloudflare-mark.svg" alt="" /></span>
          <span class="brand-copy">
            <strong>EdgeProbe</strong>
            <small>ADMIN CONSOLE</small>
          </span>
        </div>

        <div class="admin-header-actions">
          <a-button type="text" href="#/">
            <template #icon><HomeOutlined /></template>
            监控页
          </a-button>
          <a-tooltip :title="isDark ? '切换到浅色主题' : '切换到深色主题'">
            <a-button type="text" shape="circle" aria-label="切换主题" @click="$emit('toggle-theme')">
              <template #icon><BulbOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-button type="text" danger href="#/admin">
            <template #icon><LogoutOutlined /></template>
            退出
          </a-button>
        </div>
      </div>
    </header>

    <main class="admin-content">
      <a-tabs v-model:active-key="activeTab" class="admin-tabs">
        <a-tab-pane key="servers" tab="服务器">
          <div class="admin-toolbar">
            <div class="admin-filters">
              <a-input v-model:value="search" allow-clear placeholder="搜索名称、地址或分组" class="admin-search">
                <template #prefix><SearchOutlined /></template>
              </a-input>
              <a-select v-model:value="statusFilter" class="status-select">
                <a-select-option value="all">全部状态</a-select-option>
                <a-select-option value="online">在线</a-select-option>
                <a-select-option value="offline">离线</a-select-option>
              </a-select>
            </div>
            <div class="admin-toolbar-actions">
              <a-button @click="refreshing = true; finishRefresh()">
                <template #icon><ReloadOutlined :spin="refreshing" /></template>
                刷新
              </a-button>
              <a-button type="primary" @click="openCreateModal">
                <template #icon><PlusOutlined /></template>
                添加服务器
              </a-button>
            </div>
          </div>

          <a-table
            class="admin-table"
            :columns="columns"
            :data-source="filteredServers"
            :pagination="{ pageSize: 6, showSizeChanger: false, hideOnSinglePage: true }"
            :scroll="{ x: 920 }"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="admin-server-name">
                  <img :src="`/flags/${record.region}.svg`" alt="" />
                  <span>
                    <strong>{{ record.name }}</strong>
                    <small>{{ record.id }}</small>
                  </span>
                </div>
              </template>
              <template v-else-if="column.key === 'group'">
                <a-tag>{{ record.group }}</a-tag>
              </template>
              <template v-else-if="column.key === 'address'">
                <span class="mono-text">{{ record.ip }}</span>
              </template>
              <template v-else-if="column.key === 'version'">
                <span>{{ record.agentVersion }}</span>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-badge
                  :status="record.status === 'online' ? 'success' : 'error'"
                  :text="record.status === 'online' ? '在线' : '离线'"
                />
              </template>
              <template v-else-if="column.key === 'enabled'">
                <a-switch v-model:checked="record.enabled" size="small" />
              </template>
              <template v-else-if="column.key === 'actions'">
                <div class="table-actions">
                  <a-tooltip title="安装命令">
                    <a-button type="text" shape="circle" aria-label="安装命令" @click="openCommandModal(record)">
                      <template #icon><CodeOutlined /></template>
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="编辑">
                    <a-button type="text" shape="circle" aria-label="编辑" @click="openEditModal(record)">
                      <template #icon><EditOutlined /></template>
                    </a-button>
                  </a-tooltip>
                  <a-popconfirm title="确定删除这个服务器？" ok-text="删除" cancel-text="取消" @confirm="removeServer(record.id)">
                    <a-tooltip title="删除">
                      <a-button type="text" shape="circle" danger aria-label="删除">
                        <template #icon><DeleteOutlined /></template>
                      </a-button>
                    </a-tooltip>
                  </a-popconfirm>
                </div>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="settings" tab="全局设置">
          <div class="settings-layout">
            <a-card title="展示设置" class="settings-card">
              <a-form layout="vertical">
                <a-form-item label="站点标题">
                  <a-input v-model:value="settings.siteTitle" />
                </a-form-item>
                <a-form-item label="默认视图">
                  <a-select v-model:value="settings.defaultView">
                    <a-select-option value="bar">卡片</a-select-option>
                    <a-select-option value="table">表格</a-select-option>
                    <a-select-option value="ring">环形</a-select-option>
                  </a-select>
                </a-form-item>
                <div class="setting-switch-row">
                  <span>显示价格</span>
                  <a-switch v-model:checked="settings.showPrice" />
                </div>
                <div class="setting-switch-row">
                  <span>显示到期时间</span>
                  <a-switch v-model:checked="settings.showExpire" />
                </div>
                <div class="setting-switch-row">
                  <span>显示流量信息</span>
                  <a-switch v-model:checked="settings.showTraffic" />
                </div>
              </a-form>
            </a-card>

            <a-card title="采集设置" class="settings-card">
              <a-form layout="vertical">
                <a-form-item label="采集间隔">
                  <a-input-number v-model:value="settings.collectInterval" :min="1" :max="60" addon-after="秒" />
                </a-form-item>
                <a-form-item label="上报间隔">
                  <a-input-number v-model:value="settings.reportInterval" :min="10" :max="600" addon-after="秒" />
                </a-form-item>
                <div class="setting-switch-row">
                  <span>Agent 自动更新</span>
                  <a-switch v-model:checked="settings.autoUpdate" />
                </div>
              </a-form>
            </a-card>
          </div>
          <div class="settings-save-row">
            <span v-if="settingsSaved" class="save-status"><CheckCircleOutlined /> 已保存</span>
            <a-button type="primary" :loading="savingSettings" @click="saveSettings">
              <template #icon><SaveOutlined /></template>
              保存设置
            </a-button>
          </div>
        </a-tab-pane>

        <a-tab-pane key="database" tab="数据库">
          <div class="database-grid">
            <a-card title="数据迁移">
              <p>导入或导出服务器配置。</p>
              <div class="database-actions">
                <a-button><template #icon><ExportOutlined /></template>导出配置</a-button>
                <a-button><template #icon><ImportOutlined /></template>导入配置</a-button>
              </div>
            </a-card>
            <a-card title="数据库维护">
              <p>升级数据库结构或清理历史监控记录。</p>
              <div class="database-actions">
                <a-button type="primary"><template #icon><DatabaseOutlined /></template>升级数据库</a-button>
                <a-popconfirm title="确定清理全部历史记录？" ok-text="清理" cancel-text="取消">
                  <a-button danger><template #icon><DeleteOutlined /></template>清理历史</a-button>
                </a-popconfirm>
              </div>
            </a-card>
          </div>
        </a-tab-pane>
      </a-tabs>
    </main>

    <a-modal
      v-model:open="serverModalOpen"
      :title="editingServerId ? '编辑服务器' : '添加服务器'"
      ok-text="保存"
      cancel-text="取消"
      :ok-button-props="{ disabled: !serverForm.name.trim() }"
      @ok="saveServer"
    >
      <a-form layout="vertical" class="server-modal-form">
        <a-form-item label="服务器名称" required>
          <a-input v-model:value="serverForm.name" placeholder="例如 LAX Core 01" />
        </a-form-item>
        <div class="modal-form-grid">
          <a-form-item label="分组">
            <a-input v-model:value="serverForm.group" placeholder="Default" />
          </a-form-item>
          <a-form-item label="区域">
            <a-select v-model:value="serverForm.region">
              <a-select-option value="us">美国</a-select-option>
              <a-select-option value="jp">日本</a-select-option>
              <a-select-option value="de">德国</a-select-option>
              <a-select-option value="sg">新加坡</a-select-option>
            </a-select>
          </a-form-item>
        </div>
        <a-form-item label="IP 地址">
          <a-input v-model:value="serverForm.ip" placeholder="192.0.2.1" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="serverForm.note" :rows="3" placeholder="可选" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="commandModalOpen" title="安装命令" :footer="null">
      <p class="command-server-name">{{ commandServer?.name }}</p>
      <pre class="command-block">{{ installCommand }}</pre>
      <a-button type="primary" block @click="copyCommand">
        <template #icon><CodeOutlined /></template>
        {{ commandCopied ? '已复制' : '复制命令' }}
      </a-button>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AButton from 'ant-design-vue/es/button'
import ABadge from 'ant-design-vue/es/badge'
import ACard from 'ant-design-vue/es/card'
import AForm, { FormItem as AFormItem } from 'ant-design-vue/es/form'
import AInput, { Textarea as ATextarea } from 'ant-design-vue/es/input'
import AInputNumber from 'ant-design-vue/es/input-number'
import AModal from 'ant-design-vue/es/modal'
import APopconfirm from 'ant-design-vue/es/popconfirm'
import ASelect, { SelectOption as ASelectOption } from 'ant-design-vue/es/select'
import ASwitch from 'ant-design-vue/es/switch'
import ATable from 'ant-design-vue/es/table'
import ATag from 'ant-design-vue/es/tag'
import ATabs, { TabPane as ATabPane } from 'ant-design-vue/es/tabs'
import ATooltip from 'ant-design-vue/es/tooltip'
import {
  BulbOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  HomeOutlined,
  ImportOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'

import { dashboardServers, type MockServer } from '../data/dashboard'

interface ManagedServer extends MockServer {
  group: string
  enabled: boolean
  agentVersion: string
  note: string
}

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const activeTab = ref('servers')
const search = ref('')
const statusFilter = ref('all')
const refreshing = ref(false)
const serverModalOpen = ref(false)
const commandModalOpen = ref(false)
const editingServerId = ref<string | null>(null)
const commandServer = ref<ManagedServer | null>(null)
const commandCopied = ref(false)
const savingSettings = ref(false)
const settingsSaved = ref(false)

const servers = ref<ManagedServer[]>(dashboardServers.map((server) => ({
  ...server,
  group: server.tags[0] || 'Default',
  enabled: true,
  agentVersion: server.status === 'online' ? 'v1.2.4' : 'v1.2.3',
  note: '',
})))

const serverForm = reactive({ name: '', group: 'Default', region: 'us', ip: '', note: '' })
const settings = reactive({
  siteTitle: 'EdgeProbe',
  defaultView: 'bar',
  showPrice: true,
  showExpire: true,
  showTraffic: true,
  collectInterval: 3,
  reportInterval: 60,
  autoUpdate: false,
})

const columns = [
  { title: '服务器', key: 'name', width: 220 },
  { title: '分组', key: 'group', width: 100 },
  { title: '地址', key: 'address', width: 130 },
  { title: 'Agent', key: 'version', width: 100 },
  { title: '状态', key: 'status', width: 90 },
  { title: '启用', key: 'enabled', width: 70 },
  { title: '操作', key: 'actions', width: 140, fixed: 'right' as const },
]

const filteredServers = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return servers.value.filter((server) => {
    const matchesStatus = statusFilter.value === 'all' || server.status === statusFilter.value
    const matchesSearch = !keyword
      || `${server.name} ${server.ip} ${server.group} ${server.location}`.toLowerCase().includes(keyword)
    return matchesStatus && matchesSearch
  })
})

const installCommand = computed(() => commandServer.value
  ? `curl -fsSL https://example.com/install.sh | sh -s -- --id ${commandServer.value.id}`
  : '')

function finishRefresh() {
  window.setTimeout(() => { refreshing.value = false }, 500)
}

function resetServerForm() {
  Object.assign(serverForm, { name: '', group: 'Default', region: 'us', ip: '', note: '' })
}

function openCreateModal() {
  editingServerId.value = null
  resetServerForm()
  serverModalOpen.value = true
}

function openEditModal(record: ManagedServer | Record<string, unknown>) {
  const server = record as ManagedServer
  editingServerId.value = server.id
  Object.assign(serverForm, {
    name: server.name,
    group: server.group,
    region: server.region,
    ip: server.ip,
    note: server.note,
  })
  serverModalOpen.value = true
}

function saveServer() {
  if (!serverForm.name.trim()) return
  const existing = servers.value.find((server) => server.id === editingServerId.value)
  if (existing) {
    Object.assign(existing, serverForm)
  } else {
    servers.value.unshift({
      ...dashboardServers[0]!,
      id: `server-${Date.now()}`,
      name: serverForm.name,
      group: serverForm.group || 'Default',
      region: serverForm.region,
      ip: serverForm.ip || '192.0.2.1',
      location: 'New location',
      enabled: true,
      agentVersion: 'v1.2.4',
      note: serverForm.note,
    })
  }
  serverModalOpen.value = false
}

function removeServer(id: string) {
  servers.value = servers.value.filter((server) => server.id !== id)
}

function openCommandModal(record: ManagedServer | Record<string, unknown>) {
  commandServer.value = record as ManagedServer
  commandCopied.value = false
  commandModalOpen.value = true
}

async function copyCommand() {
  await navigator.clipboard?.writeText(installCommand.value)
  commandCopied.value = true
}

function saveSettings() {
  savingSettings.value = true
  settingsSaved.value = false
  window.setTimeout(() => {
    savingSettings.value = false
    settingsSaved.value = true
  }, 600)
}
</script>
