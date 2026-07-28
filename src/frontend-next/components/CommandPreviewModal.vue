<template>
  <a-modal v-model:open="open" title="安装命令" width="720px" :footer="null">
    <template v-if="server">
      <div class="command-modal-head"><span><strong>{{ server.name }}</strong><small>{{ server.id }}</small></span><a-select v-model:value="targetOS" :options="targetOSOptions" /></div>
      <a-descriptions bordered size="small" :column="2" class="command-config">
        <a-descriptions-item label="采集间隔">{{ server.collectInterval }} 秒</a-descriptions-item>
        <a-descriptions-item label="上报间隔">{{ server.reportInterval }} 秒</a-descriptions-item>
        <a-descriptions-item label="流量重置">每月 {{ server.resetDay }} 日</a-descriptions-item>
        <a-descriptions-item label="自动更新">{{ server.autoUpdate ? '启用' : '关闭' }}</a-descriptions-item>
        <a-descriptions-item label="下行修正">{{ server.rxCorrection }} GB</a-descriptions-item>
        <a-descriptions-item label="上行修正">{{ server.txCorrection }} GB</a-descriptions-item>
      </a-descriptions>
      <pre class="command-block">{{ command }}</pre>
      <div class="command-modal-actions"><a-button @click="$emit('edit', server)"><template #icon><EditOutlined /></template>编辑参数</a-button><a-button type="primary" @click="copy"><template #icon><CopyOutlined /></template>{{ copied ? '已复制' : '复制命令' }}</a-button></div>
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
import { buildInstallCommand, targetOSOptions } from '../utils/mock-admin'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ server: ManagedServer | null }>()
defineEmits<{ edit: [server: ManagedServer] }>()
const targetOS = ref<TargetOS>('linux')
const copied = ref(false)
const command = computed(() => props.server ? buildInstallCommand(props.server, targetOS.value) : '')
watch([open, targetOS], () => { copied.value = false })
async function copy() { await navigator.clipboard?.writeText(command.value); copied.value = true }
</script>

