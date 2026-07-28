<template>
  <a-modal v-model:open="open" title="删除服务器" ok-text="确认删除" cancel-text="取消" ok-type="danger" @ok="server && $emit('confirm', server.id)">
    <template v-if="server">
      <a-alert type="warning" show-icon :message="`删除 ${server.name} 后，其历史数据也将不可访问。`" class="delete-alert" />
      <a-form layout="vertical">
        <a-form-item label="目标系统"><a-select v-model:value="targetOS" :options="targetOSOptions" /></a-form-item>
        <a-form-item label="建议先执行卸载命令"><pre class="command-block compact">{{ command }}</pre><a-button block @click="copy"><template #icon><CopyOutlined /></template>{{ copied ? '已复制' : '复制卸载命令' }}</a-button></a-form-item>
      </a-form>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AAlert from 'ant-design-vue/es/alert'
import AButton from 'ant-design-vue/es/button'
import AForm, { FormItem as AFormItem } from 'ant-design-vue/es/form'
import AModal from 'ant-design-vue/es/modal'
import ASelect from 'ant-design-vue/es/select'
import { CopyOutlined } from '@ant-design/icons-vue'
import type { ManagedServer, TargetOS } from '../data/admin'
import { buildUninstallCommand, targetOSOptions } from '../utils/mock-admin'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ server: ManagedServer | null; apiBase: string }>()
defineEmits<{ confirm: [id: string] }>()
const targetOS = ref<TargetOS>('linux')
const copied = ref(false)
const command = computed(() => props.server ? buildUninstallCommand(props.server, targetOS.value, props.apiBase) : '')
watch([open, targetOS], () => { copied.value = false })
async function copy() { await navigator.clipboard?.writeText(command.value); copied.value = true }
</script>
