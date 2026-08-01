<template>
  <a-modal v-model:open="open" :title="t('deleteServer')" :ok-text="t('confirmDelete')" :cancel-text="t('cancel')" ok-type="danger" @ok="server && $emit('confirm', server.id)">
    <template v-if="server">
      <a-alert type="warning" show-icon :message="t('deleteWarning', { name: server.name })" class="delete-alert" />
      <a-form layout="vertical">
        <a-form-item :label="t('targetSystem')"><a-select v-model:value="targetOS" :options="localizedTargetOSOptions" /></a-form-item>
        <a-form-item :label="t('uninstallFirst')"><pre class="command-block compact">{{ command }}</pre><a-button block @click="copy"><template #icon><CopyOutlined /></template>{{ copied ? t('copied') : t('copyUninstall') }}</a-button></a-form-item>
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
import { buildUninstallCommand } from '../utils/mock-admin'
import { t } from '../utils/i18n'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ server: ManagedServer | null; apiBase: string }>()
defineEmits<{ confirm: [id: string] }>()
const targetOS = ref<TargetOS>('linux')
const localizedTargetOSOptions = computed(() => [
  { label: t('linuxAuto'), value: 'linux' }, { label: t('macPlatform'), value: 'mac' }, { label: t('windows'), value: 'windows' },
])
const copied = ref(false)
const command = computed(() => props.server ? buildUninstallCommand(props.server, targetOS.value, props.apiBase) : '')
watch([open, targetOS], () => { copied.value = false })
async function copy() { await navigator.clipboard?.writeText(command.value); copied.value = true }
</script>
