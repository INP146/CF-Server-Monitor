<template>
  <section class="summary-grid" aria-label="服务器摘要">
    <a-card class="summary-card">
      <a-statistic title="服务器" :value="total">
        <template #prefix><CloudServerOutlined class="stat-icon orange" /></template>
      </a-statistic>
      <div class="summary-foot"><span class="status-dot online" /> {{ online }} 台在线 · {{ offline }} 台离线</div>
    </a-card>
    <a-card class="summary-card">
      <a-statistic title="平均 CPU" :value="averageCpu" suffix="%">
        <template #prefix><LineChartOutlined class="stat-icon green" /></template>
      </a-statistic>
      <div class="summary-foot positive">所有在线节点</div>
    </a-card>
    <a-card class="summary-card">
      <a-statistic title="下载速率" :value="downloadRate" :precision="2" suffix="MB/s">
        <template #prefix><DownloadOutlined class="stat-icon blue" /></template>
      </a-statistic>
      <div class="summary-foot">总计 {{ downloadTotal }}</div>
    </a-card>
    <a-card class="summary-card">
      <a-statistic title="上传速率" :value="uploadRate" :precision="2" suffix="MB/s">
        <template #prefix><UploadOutlined class="stat-icon yellow" /></template>
      </a-statistic>
      <div class="summary-foot">总计 {{ uploadTotal }}</div>
    </a-card>
  </section>
</template>

<script setup lang="ts">
import ACard from 'ant-design-vue/es/card'
import AStatistic from 'ant-design-vue/es/statistic'
import { CloudServerOutlined, DownloadOutlined, LineChartOutlined, UploadOutlined } from '@ant-design/icons-vue'

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
