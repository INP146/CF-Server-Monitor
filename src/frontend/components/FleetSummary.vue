<template>
  <section class="summary-grid" :aria-label="t('serverSummary')">
    <a-card class="summary-card">
      <a-statistic :title="t('servers')" :value="total">
        <template #prefix><CloudServerOutlined class="stat-icon orange" /></template>
      </a-statistic>
      <div class="summary-foot"><span class="status-dot online" /> {{ t('onlineOffline', { online, offline }) }}</div>
    </a-card>
    <a-card class="summary-card">
      <a-statistic :title="t('averageCpu')" :value="averageCpu" suffix="%">
        <template #prefix><LineChartOutlined class="stat-icon green" /></template>
      </a-statistic>
      <div class="summary-foot positive">{{ t('allOnlineNodes') }}</div>
    </a-card>
    <a-card class="summary-card">
      <a-statistic :title="t('downloadRate')" :value="downloadRate" :precision="2" suffix="MB/s">
        <template #prefix><DownloadOutlined class="stat-icon blue" /></template>
      </a-statistic>
      <div class="summary-foot">{{ t('total') }} {{ downloadTotal }}</div>
    </a-card>
    <a-card class="summary-card">
      <a-statistic :title="t('uploadRate')" :value="uploadRate" :precision="2" suffix="MB/s">
        <template #prefix><UploadOutlined class="stat-icon yellow" /></template>
      </a-statistic>
      <div class="summary-foot">{{ t('total') }} {{ uploadTotal }}</div>
    </a-card>
  </section>
</template>

<script setup lang="ts">
import ACard from 'ant-design-vue/es/card'
import AStatistic from 'ant-design-vue/es/statistic'
import { CloudServerOutlined, DownloadOutlined, LineChartOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { t } from '../utils/i18n'

defineProps<{
  total: number
  online: number
  offline: number
  averageCpu: number
  downloadRate: number
  downloadTotal: string
  uploadRate: number
  uploadTotal: string
}>()
</script>
