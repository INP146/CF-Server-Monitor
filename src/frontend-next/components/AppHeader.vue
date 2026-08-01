<template>
  <header class="app-header">
    <div class="app-header-inner">
      <a class="app-header-brand" href="#/" :aria-label="`${title} ${t('dashboard')}`">
        <span class="brand-mark"><img src="/cloudflare-mark.svg" alt="" /></span>
        <span class="brand-copy">
          <strong>{{ title }}</strong>
          <small>{{ subtitle }}</small>
        </span>
      </a>

      <div class="app-header-actions">
        <slot />
        <a-tooltip :title="t('switchLanguage')">
          <a-button type="text" shape="circle" :aria-label="t('switchLanguage')" @click="toggleLanguage">{{ currentLanguage === 'zh' ? 'EN' : '中' }}</a-button>
        </a-tooltip>
        <a-tooltip :title="themeTitle">
          <a-button type="text" shape="circle" :aria-label="themeTitle" @click="$emit('toggle-theme')">
            <template #icon><BulbOutlined /></template>
          </a-button>
        </a-tooltip>
        <slot name="end" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AButton from 'ant-design-vue/es/button'
import ATooltip from 'ant-design-vue/es/tooltip'
import { BulbOutlined } from '@ant-design/icons-vue'
import { useTheme } from '../composables/useTheme'
import { currentLanguage, t, toggleLanguage } from '../utils/i18n'

const { currentTheme } = useTheme()
const themeTitle = computed(() => t(currentTheme.value === 'auto' ? 'themeAuto' : currentTheme.value === 'dark' ? 'themeDark' : 'themeLight'))

withDefaults(defineProps<{
  isDark: boolean
  subtitle: string
  title?: string
}>(), {
  title: 'EdgeProbe',
})

defineEmits<{ 'toggle-theme': [] }>()
</script>
