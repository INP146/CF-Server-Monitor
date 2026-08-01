<template>
  <a-modal v-model:open="open" :title="server ? `${t('edit')} ${t('server')} · ${server.name}` : t('addServer')" width="880px" :ok-text="t('save')" :cancel-text="t('cancel')" :ok-button-props="{ disabled: !form.name.trim() || hasPingErrors }" @ok="submit">
    <a-tabs v-model:active-key="activeTab" class="modal-tabs">
      <a-tab-pane key="basic" :tab="t('basicInfo')">
        <a-form layout="vertical" class="server-modal-form">
          <div class="modal-form-grid three-columns">
            <a-form-item :label="t('serverName')" required><a-input v-model:value="form.name" placeholder="LAX Core 01" /></a-form-item>
            <a-form-item :label="t('group')"><a-input v-model:value="form.group" placeholder="Default" /></a-form-item>
            <a-form-item :label="t('regionCode')"><a-input v-model:value="form.region" placeholder="US" /></a-form-item>
          </div>
          <a-form-item :label="t('tags')"><a-select v-model:value="form.tags" mode="tags" :placeholder="t('tagsPlaceholder')" :options="tagOptions" /></a-form-item>
          <a-form-item :label="t('note')"><a-textarea v-model:value="form.note" :rows="3" :placeholder="t('notePlaceholder')" /></a-form-item>
          <div class="modal-switch-grid">
            <label><span>{{ t('hidePublic') }}</span><a-switch v-model:checked="form.isHidden" /></label>
            <label><span>{{ t('disableOfflineNotification') }}</span><a-switch v-model:checked="form.offlineNotifyDisabled" /></label>
          </div>
        </a-form>
      </a-tab-pane>

      <a-tab-pane key="billing" :tab="t('billingTraffic')">
        <a-form layout="vertical" class="server-modal-form">
          <div class="modal-form-grid three-columns">
            <a-form-item :label="t('price')"><a-input-number v-model:value="form.price" :min="0" :precision="2" /></a-form-item>
            <a-form-item :label="t('currency')"><a-select v-model:value="form.currency" :options="currencyOptions" /></a-form-item>
            <a-form-item :label="t('billingCycle')"><a-select v-model:value="form.billingCycle" :options="billingOptions" /></a-form-item>
          </div>
          <div class="modal-form-grid">
            <a-form-item :label="t('expiryDate')"><a-input v-model:value="form.expireDate" type="date" /></a-form-item>
            <a-form-item :label="t('autoRenewal')"><div class="inline-switch"><a-switch v-model:checked="form.autoRenewal" /><span>{{ t('autoRenewalHint') }}</span></div></a-form-item>
          </div>
          <div class="modal-form-grid three-columns">
            <a-form-item :label="t('trafficLimit')"><a-input-number v-model:value="form.trafficLimit" :min="0" addon-after="GB" /></a-form-item>
            <a-form-item :label="t('trafficCalculation')"><a-select v-model:value="form.trafficCalcType" :options="trafficOptions" /></a-form-item>
            <a-form-item :label="t('resetDay')"><a-input-number v-model:value="form.resetDay" :min="0" :max="31" /></a-form-item>
          </div>
          <div class="modal-form-grid">
            <a-form-item :label="t('rxCorrection')"><a-input-number :value="form.rxCorrection ?? undefined" :min="0" :precision="1" addon-after="GB" @update:value="form.rxCorrection = normalizeCorrectionInput($event)" /></a-form-item>
            <a-form-item :label="t('txCorrection')"><a-input-number :value="form.txCorrection ?? undefined" :min="0" :precision="1" addon-after="GB" @update:value="form.txCorrection = normalizeCorrectionInput($event)" /></a-form-item>
          </div>
        </a-form>
      </a-tab-pane>

      <a-tab-pane key="agent" :tab="t('agentProbe')">
        <a-form layout="vertical" class="server-modal-form">
          <div class="modal-form-grid three-columns">
            <a-form-item :label="t('collectInterval')"><a-select v-model:value="form.collectInterval" :options="collectIntervalOptions" /></a-form-item>
            <a-form-item :label="t('reportInterval')"><a-select v-model:value="form.reportInterval" :options="reportIntervalOptions" /></a-form-item>
            <a-form-item :label="t('autoUpdate')"><div class="inline-switch"><a-switch v-model:checked="form.autoUpdate" /><span>{{ t('autoInstallAgent') }}</span></div></a-form-item>
          </div>
          <a-alert v-if="form.autoUpdate" type="warning" show-icon :message="t('autoUpdateWarning')" class="editor-alert" />
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
import { BILLING_CYCLES, CURRENCY_OPTIONS } from '../utils/server'
import { validatePingNode } from '../utils/ping-node'
import { currentLanguage, t } from '../utils/i18n'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  server: ManagedServer | null
  pingDefaults?: Pick<ManagedServer, 'customCt' | 'customCu' | 'customCm' | 'customBd'>
}>()
const emit = defineEmits<{ save: [server: ManagedServer] }>()
const activeTab = ref('basic')

const emptyServer = (): ManagedServer => ({
  id: `draft-${Date.now()}`,
  name: '',
  group: 'Default',
  tags: [],
  region: 'us',
  ip: '',
  location: '',
  os: '',
  arch: '',
  status: 'offline',
  cpu: 0,
  memory: 0,
  disk: 0,
  download: '0 B/s',
  upload: '0 B/s',
  latency: null,
  uptime: '-',
  load: '- / - / -',
  enabled: true,
  agentVersion: t('waitingInstall'),
  note: '',
  price: 0,
  currency: '$',
  billingCycle: 'month',
  expireDate: '',
  autoRenewal: false,
  trafficLimit: 0,
  trafficCalcType: 'total',
  resetDay: 1,
  collectInterval: 0,
  reportInterval: 60,
  customCt: '',
  customCu: '',
  customCm: '',
  customBd: '',
  rxCorrection: null,
  txCorrection: null,
  autoUpdate: false,
  isHidden: false,
  offlineNotifyDisabled: false,
})

const form = reactive<ManagedServer>(emptyServer())

function cloneServer(server: ManagedServer): ManagedServer {
  return structuredClone(toRaw(server))
}

watch(() => [open.value, props.server] as const, ([isOpen, server]) => {
  if (!isOpen) return
  Object.assign(form, emptyServer(), server ? cloneServer(server) : props.pingDefaults || {})
  activeTab.value = 'basic'
}, { immediate: true })

const tagOptions = ['Core', 'Edge', 'IPv4', 'IPv6', 'IPv4/6'].map((value) => ({ label: value, value }))
const currencyOptions = computed(() => CURRENCY_OPTIONS.slice(0, 10).map((item) => ({ label: `${item.symbol} ${currentLanguage.value === 'zh' ? item.nameZh : item.nameEn}`, value: item.symbol })))
const billingOptions = computed(() => BILLING_CYCLES.map((item) => ({ label: currentLanguage.value === 'zh' ? item.labelZh : item.labelEn, value: item.value })))
const trafficOptions = computed(() => [
  { label: t('trafficTotal'), value: 'total' }, { label: t('uploadOnly'), value: 'ul' }, { label: t('downloadOnly'), value: 'dl' }, { label: t('trafficMax'), value: 'max' },
])
const collectIntervalOptions = computed(() => [0, 1, 2, 5, 10].map((value) => ({ label: value === 0 ? t('disableCachedSampling') : t('seconds', { count: value }), value })))
const reportIntervalOptions = computed(() => [30, 60, 120, 180].map((value) => ({ label: t('seconds', { count: value }), value })))
const pingNodes = computed(() => [
  { key: 'customCt' as const, label: t('telecomProbe'), placeholder: 'gd-ct-dualstack.ip.zstaticcdn.com' },
  { key: 'customCu' as const, label: t('unicomProbe'), placeholder: 'gd-cu-dualstack.ip.zstaticcdn.com' },
  { key: 'customCm' as const, label: t('mobileProbe'), placeholder: 'gd-cm-dualstack.ip.zstaticcdn.com' },
  { key: 'customBd' as const, label: t('baiduProbe'), placeholder: 'ip.zstaticcdn.com' },
])

function pingError(key: 'customCt' | 'customCu' | 'customCm' | 'customBd') {
  const value = form[key]
  return value && !validatePingNode(value).valid ? t('invalidPingNode') : ''
}
const hasPingErrors = computed(() => pingNodes.value.some((node) => Boolean(pingError(node.key))))

function normalizeCorrectionInput(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

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
