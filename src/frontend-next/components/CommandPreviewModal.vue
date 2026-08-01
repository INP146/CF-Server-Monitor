<template>
  <a-modal v-model:open="open" :title="t('commandTitle')" width="720px" :footer="null">
    <template v-if="server">
      <div class="command-modal-head"><span><strong>{{ server.name }}</strong><small>{{ server.id }}</small></span><a-select v-model:value="targetOS" :options="localizedTargetOSOptions" /></div>
      <a-descriptions bordered size="small" :column="2" class="command-config">
        <a-descriptions-item :label="t('collectInterval')">{{ t('seconds', { count: server.collectInterval }) }}</a-descriptions-item>
        <a-descriptions-item :label="t('reportInterval')">{{ t('seconds', { count: server.reportInterval }) }}</a-descriptions-item>
        <a-descriptions-item :label="t('trafficReset')">{{ t('monthlyDay', { day: server.resetDay }) }}</a-descriptions-item>
        <a-descriptions-item :label="t('autoUpdate')">{{ server.autoUpdate ? t('enabled') : t('disabled') }}</a-descriptions-item>
        <a-descriptions-item :label="t('rxCorrection')">{{ correctionText(server.rxCorrection) }}</a-descriptions-item>
        <a-descriptions-item :label="t('txCorrection')">{{ correctionText(server.txCorrection) }}</a-descriptions-item>
      </a-descriptions>
      <pre class="command-block">{{ command }}</pre>
      <div class="command-modal-actions"><a-button @click="$emit('edit', server)"><template #icon><EditOutlined /></template>{{ t('editParameters') }}</a-button><a-button type="primary" @click="copy"><template #icon><CopyOutlined /></template>{{ copied ? t('copied') : t('copyCommand') }}</a-button></div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AButton from 'ant-design-vue/es/button'
import ADescriptions, { DescriptionsItem as ADescriptionsItem } from 'ant-design-vue/es/descriptions'
import AModal from 'ant-design-vue/es/modal'
import ASelect from 'ant-design-vue/es/select'
import { CopyOutlined, EditOutlined } from '@ant-design/icons-vue'
import type { ManagedServer, TargetOS } from '../data/admin'
import { buildInstallCommand } from '../utils/mock-admin'
import { t } from '../utils/i18n'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ server: ManagedServer | null; apiBase: string; apiSecret: string }>()
defineEmits<{ edit: [server: ManagedServer] }>()
const targetOS = ref<TargetOS>('linux')
const localizedTargetOSOptions = computed(() => [
  { label: t('linuxAuto'), value: 'linux' }, { label: t('macPlatform'), value: 'mac' }, { label: t('windows'), value: 'windows' },
])
const copied = ref(false)
const command = computed(() => props.server ? buildInstallCommand(props.server, targetOS.value, props.apiBase, props.apiSecret) : '')
watch([open, targetOS], () => { copied.value = false })
function correctionText(value: number | null) { return value === null ? t('unset') : `${value} GB` }
async function copy() { await navigator.clipboard?.writeText(command.value); copied.value = true }
</script>
