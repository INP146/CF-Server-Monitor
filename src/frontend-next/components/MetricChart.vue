<template>
  <div class="metric-chart" :class="{ 'is-empty': !values.length }">
    <svg v-if="values.length" viewBox="0 0 320 92" preserveAspectRatio="none" role="img" :aria-label="`${title}趋势图`">
      <line v-for="y in [18, 46, 74]" :key="y" x1="0" :y1="y" x2="320" :y2="y" class="chart-grid-line" />
      <polygon :points="areaPoints" :fill="`${color}18`" />
      <polyline :points="linePoints" fill="none" :stroke="color" stroke-width="2.5" vector-effect="non-scaling-stroke" />
    </svg>
    <span v-else>暂无数据</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  values: number[]
  color?: string
}>(), {
  color: '#1677ff',
})

const points = computed(() => {
  if (!props.values.length) return []
  const max = Math.max(...props.values, 1)
  const min = Math.min(...props.values, 0)
  const range = Math.max(max - min, 1)
  return props.values.map((value, index) => ({
    x: props.values.length === 1 ? 160 : index / (props.values.length - 1) * 320,
    y: 82 - (value - min) / range * 70,
  }))
})

const linePoints = computed(() => points.value.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '))
const areaPoints = computed(() => `0,92 ${linePoints.value} 320,92`)
</script>
