<template>
  <header class="app-header">
    <div class="app-header-inner">
      <a class="app-header-brand" href="#/" :aria-label="`${title} 监控页`">
        <span class="brand-mark"><img src="/cloudflare-mark.svg" alt="" /></span>
        <span class="brand-copy">
          <strong>{{ title }}</strong>
          <small>{{ subtitle }}</small>
        </span>
      </a>

      <div class="app-header-actions">
        <slot />
        <a-tooltip :title="isDark ? '切换到浅色主题' : '切换到深色主题'">
          <a-button type="text" shape="circle" aria-label="切换主题" @click="$emit('toggle-theme')">
            <template #icon><BulbOutlined /></template>
          </a-button>
        </a-tooltip>
        <slot name="end" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import AButton from 'ant-design-vue/es/button'
import ATooltip from 'ant-design-vue/es/tooltip'
import { BulbOutlined } from '@ant-design/icons-vue'

withDefaults(defineProps<{
  isDark: boolean
  subtitle: string
  title?: string
}>(), {
  title: 'EdgeProbe',
})

defineEmits<{ 'toggle-theme': [] }>()
</script>
