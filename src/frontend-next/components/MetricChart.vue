<template>
  <div class="metric-chart" :class="{ 'is-empty': !hasValues }">
    <template v-if="hasValues">
      <div v-if="displaySeries.length > 1" class="metric-chart-legend" aria-label="图表图例">
        <span v-for="item in displaySeries" :key="item.label">
          <i :style="{ background: item.color }" />{{ item.label }}
        </span>
      </div>
      <div class="metric-chart-plot">
        <div class="metric-chart-y-axis" aria-hidden="true">
          <span v-for="tick in tickLabels" :key="tick">{{ tick }}</span>
        </div>
        <svg viewBox="0 0 320 92" preserveAspectRatio="none" role="img" :aria-label="`${title}趋势图`">
          <line v-for="y in [10, 46, 82]" :key="y" x1="0" :y1="y" x2="320" :y2="y" class="chart-grid-line" />
          <template v-for="item in plottedSeries" :key="item.label">
            <polygon v-if="item.fill" :points="item.areaPoints" :fill="`${item.color}0D`" />
            <polyline :points="item.linePoints" fill="none" :stroke="item.color" stroke-width="1.5" vector-effect="non-scaling-stroke" />
          </template>
        </svg>
      </div>
    </template>
    <span v-else>暂无数据</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ChartSeries {
  label: string
  values: number[]
  color: string
  fill?: boolean
}

const props = withDefaults(defineProps<{
  title: string
  values?: number[]
  color?: string
  unit?: string
  series?: ChartSeries[]
}>(), {
  values: () => [],
  color: '#1677ff',
  unit: '',
  series: () => [],
})

const displaySeries = computed<ChartSeries[]>(() => props.series.length ? props.series : [{
  label: props.title,
  values: props.values,
  color: props.color,
  fill: true,
}])

const allValues = computed(() => displaySeries.value.flatMap((item) => item.values).filter(Number.isFinite))
const hasValues = computed(() => allValues.value.length > 0)

function niceCeiling(value: number) {
  const safeValue = Math.max(value, 0.1)
  const magnitude = 10 ** Math.floor(Math.log10(safeValue))
  const normalized = safeValue / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

const scaleMax = computed(() => niceCeiling(Math.max(...allValues.value, 0) * 1.08))

function formatTick(value: number) {
  let output: string
  if (value >= 1000) output = `${Number((value / 1000).toFixed(1))}k`
  else if (value > 0 && value < 1) output = String(Number(value.toFixed(2)))
  else output = String(Number(value.toFixed(1)))
  return `${output}${props.unit}`
}

const tickLabels = computed(() => [scaleMax.value, scaleMax.value / 2, 0].map(formatTick))

const plottedSeries = computed(() => displaySeries.value.map((series) => {
  const points = series.values.map((value, index) => ({
    x: series.values.length === 1 ? 160 : index / (series.values.length - 1) * 320,
    y: 82 - Math.max(0, value) / scaleMax.value * 72,
  }))
  const linePoints = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return {
    ...series,
    fill: series.fill !== false,
    linePoints,
    areaPoints: `0,82 ${linePoints} 320,82`,
  }
}))
</script>
