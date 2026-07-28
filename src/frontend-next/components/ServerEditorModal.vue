<template>
  <a-modal v-model:open="open" :title="server ? `编辑服务器 · ${server.name}` : '添加服务器'" width="880px" ok-text="保存" cancel-text="取消" :ok-button-props="{ disabled: !form.name.trim() || hasPingErrors }" @ok="submit">
    <a-tabs v-model:active-key="activeTab" class="modal-tabs">
      <a-tab-pane key="basic" tab="基本信息">
        <a-form layout="vertical" class="server-modal-form">
          <div class="modal-form-grid three-columns">
            <a-form-item label="服务器名称" required><a-input v-model:value="form.name" placeholder="例如 LAX Core 01" /></a-form-item>
            <a-form-item label="分组"><a-input v-model:value="form.group" placeholder="Default" /></a-form-item>
            <a-form-item label="区域代码"><a-input v-model:value="form.region" placeholder="US" /></a-form-item>
          </div>
          <a-form-item label="标签"><a-select v-model:value="form.tags" mode="tags" placeholder="输入后回车" :options="tagOptions" /></a-form-item>
          <a-form-item label="IP 地址"><a-input v-model:value="form.ip" placeholder="由 Agent 自动上报" /></a-form-item>
          <a-form-item label="备注"><a-textarea v-model:value="form.note" :rows="3" placeholder="可选，后台双击可快速复制" /></a-form-item>
          <div class="modal-switch-grid">
            <label><span>启用节点</span><a-switch v-model:checked="form.enabled" /></label>
            <label><span>从公开页面隐藏</span><a-switch v-model:checked="form.isHidden" /></label>
            <label><span>禁用离线通知</span><a-switch v-model:checked="form.offlineNotifyDisabled" /></label>
          </div>
        </a-form>
      </a-tab-pane>

      <a-tab-pane key="billing" tab="费用与流量">
        <a-form layout="vertical" class="server-modal-form">
          <div class="modal-form-grid three-columns">
            <a-form-item label="价格"><a-input-number v-model:value="form.price" :min="0" :precision="2" /></a-form-item>
            <a-form-item label="币种"><a-select v-model:value="form.currency" :options="currencyOptions" /></a-form-item>
            <a-form-item label="计费周期"><a-select v-model:value="form.billingCycle" :options="billingOptions" /></a-form-item>
          </div>
          <div class="modal-form-grid">
            <a-form-item label="到期时间"><a-input v-model:value="form.expireDate" type="date" /></a-form-item>
            <a-form-item label="自动续费"><div class="inline-switch"><a-switch v-model:checked="form.autoRenewal" /><span>到期后自动顺延计费周期</span></div></a-form-item>
          </div>
          <div class="modal-form-grid three-columns">
            <a-form-item label="月流量额度"><a-input-number v-model:value="form.trafficLimit" :min="0" addon-after="GB" /></a-form-item>
            <a-form-item label="流量计算"><a-select v-model:value="form.trafficCalcType" :options="trafficOptions" /></a-form-item>
            <a-form-item label="重置日"><a-input-number v-model:value="form.resetDay" :min="0" :max="31" addon-after="日" /></a-form-item>
          </div>
          <div class="modal-form-grid">
            <a-form-item label="下行修正"><a-input-number v-model:value="form.rxCorrection" :min="0" :precision="1" addon-after="GB" /></a-form-item>
            <a-form-item label="上行修正"><a-input-number v-model:value="form.txCorrection" :min="0" :precision="1" addon-after="GB" /></a-form-item>
          </div>
        </a-form>
      </a-tab-pane>

      <a-tab-pane key="agent" tab="Agent 与探测">
        <a-form layout="vertical" class="server-modal-form">
          <div class="modal-form-grid three-columns">
            <a-form-item label="采集间隔"><a-select v-model:value="form.collectInterval" :options="collectIntervalOptions" /></a-form-item>
            <a-form-item label="上报间隔"><a-select v-model:value="form.reportInterval" :options="reportIntervalOptions" /></a-form-item>
            <a-form-item label="自动更新"><div class="inline-switch"><a-switch v-model:checked="form.autoUpdate" /><span>自动安装新 Agent</span></div></a-form-item>
          </div>
          <a-alert v-if="form.autoUpdate" type="warning" show-icon message="自动更新会执行远程升级脚本，请先确认节点环境兼容。" class="editor-alert" />
          <div class="modal-form-grid">
            <a-form-item v-for="node in pingNodes" :key="node.key" :label="node.label" :validate-status="pingError(node.key) ? 'error' : ''" :help="pingError(node.key)">
              <a-input v-model:value="form[node.key]" :placeholder="node.placeholder" />
            </a-form-item>
          </div>
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, toRaw, watch } from 'vue'
import AAlert from 'ant-design-vue/es/alert'
import AForm, { FormItem as AFormItem } from 'ant-design-vue/es/form'
import AInput, { Textarea as ATextarea } from 'ant-design-vue/es/input'
import AInputNumber from 'ant-design-vue/es/input-number'
import AModal from 'ant-design-vue/es/modal'
import ASelect from 'ant-design-vue/es/select'
import ASwitch from 'ant-design-vue/es/switch'
import ATabs, { TabPane as ATabPane } from 'ant-design-vue/es/tabs'

import type { ManagedServer } from '../data/admin'
import { dashboardServers } from '../data/dashboard'
import { BILLING_CYCLES, CURRENCY_OPTIONS } from '../utils/server'
import { validatePingNode } from '../utils/ping-node'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ server: ManagedServer | null }>()
const emit = defineEmits<{ save: [server: ManagedServer] }>()
const activeTab = ref('basic')

const emptyServer = (): ManagedServer => ({
  ...dashboardServers[0]!, id: `server-${Date.now()}`, name: '', group: 'Default', tags: [], region: 'us', ip: '', location: 'New location', status: 'offline', cpu: 0, memory: 0, disk: 0, download: '0 B/s', upload: '0 B/s', latency: null, uptime: '-', load: '- / - / -', enabled: true, agentVersion: '等待安装', note: '', price: 0, currency: '$', billingCycle: 'month', expireDate: '', autoRenewal: false, trafficLimit: 0, trafficCalcType: 'total', resetDay: 1, collectInterval: 0, reportInterval: 60, customCt: '', customCu: '', customCm: '', customBd: '', rxCorrection: 0, txCorrection: 0, autoUpdate: false, isHidden: false, offlineNotifyDisabled: false,
})

const form = reactive<ManagedServer>(emptyServer())

function cloneServer(server: ManagedServer): ManagedServer {
  return structuredClone(toRaw(server))
}

watch(() => [open.value, props.server] as const, ([isOpen, server]) => {
  if (!isOpen) return
  Object.assign(form, emptyServer(), server ? cloneServer(server) : {})
  activeTab.value = 'basic'
}, { immediate: true })

const tagOptions = ['Core', 'Edge', 'IPv4', 'IPv6', 'IPv4/6'].map((value) => ({ label: value, value }))
const currencyOptions = CURRENCY_OPTIONS.slice(0, 10).map((item) => ({ label: `${item.symbol} ${item.nameZh}`, value: item.symbol }))
const billingOptions = BILLING_CYCLES.map((item) => ({ label: item.labelZh, value: item.value }))
const trafficOptions = [
  { label: '上下行合计', value: 'total' }, { label: '仅上行', value: 'ul' }, { label: '仅下行', value: 'dl' }, { label: '取较大值', value: 'max' },
]
const collectIntervalOptions = [0, 1, 2, 5, 10].map((value) => ({ label: value === 0 ? '关闭缓存采样' : `${value} 秒`, value }))
const reportIntervalOptions = [30, 60, 120, 180].map((value) => ({ label: `${value} 秒`, value }))
const pingNodes = [
  { key: 'customCt' as const, label: '中国电信探测点', placeholder: 'gd-ct-dualstack.ip.zstaticcdn.com' },
  { key: 'customCu' as const, label: '中国联通探测点', placeholder: 'gd-cu-dualstack.ip.zstaticcdn.com' },
  { key: 'customCm' as const, label: '中国移动探测点', placeholder: 'gd-cm-dualstack.ip.zstaticcdn.com' },
  { key: 'customBd' as const, label: '百度探测点', placeholder: 'ip.zstaticcdn.com' },
]

function pingError(key: typeof pingNodes[number]['key']) {
  const value = form[key]
  return value && !validatePingNode(value).valid ? '请输入有效的域名、IP 或 host:port' : ''
}
const hasPingErrors = computed(() => pingNodes.some((node) => Boolean(pingError(node.key))))

function submit() {
  if (!form.name.trim() || hasPingErrors.value) return
  const server = cloneServer(form)
  server.name = server.name.trim()
  server.group = server.group.trim() || 'Default'
  server.region = server.region.trim().toLowerCase()
  emit('save', server)
  open.value = false
}
</script>
