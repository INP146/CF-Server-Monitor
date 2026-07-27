<template>
  <a-config-provider :theme="themeConfig">
    <router-view v-slot="{ Component }">
      <component :is="Component" :is-dark="isDark" @toggle-theme="isDark = !isDark" />
    </router-view>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AConfigProvider from 'ant-design-vue/es/config-provider'
import antTheme from 'ant-design-vue/es/theme'

const isDark = ref(false)

const themeConfig = computed(() => ({
  algorithm: isDark.value ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#f38020',
    colorLink: '#d96710',
    borderRadius: 6,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
}))
</script>
