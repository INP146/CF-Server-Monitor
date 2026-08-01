<template>
  <div class="metric-chart" :class="{ 'is-empty': !hasValues }">
    <template v-if="hasValues">
      <div v-if="displaySeries.length > 1" class="metric-chart-legend" :aria-label="t('chartLegend')">
        <span v-for="item in displaySeries" :key="item.label">
          <i :style="{ background: item.color }" />{{ item.label }}
        </span>
      </div>
      <div class="metric-chart-plot">
        <div class="metric-chart-y-axis" aria-hidden="true">
          <span v-for="tick in tickLabels" :key="tick">{{ tick }}</span>
        </div>
        <svg viewBox="0 0 320 92" preserveAspectRatio="none" role="img" :aria-label="t('trendChart', { title })">
          <line v-for="y in [10, 46, 82]" :key="y" x1="0" :y1="y" x2="320" :y2="y" class="chart-grid-line" />
          <template v-for="item in plottedSeries" :key="item.label">
            <template v-for="(segment, index) in item.segments" :key="`${item.label}-${index}`">
              <polygon v-if="item.fill && segment.areaPoints" :points="segment.areaPoints" :fill="`${item.color}0D`" />
              <polyline :points="segment.linePoints" fill="none" :stroke="item.color" stroke-width="1.5" vector-effect="non-scaling-stroke" />
            </template>
          </template>
        </svg>
      </div>
    </template>
    <span v-else>{{ t('noData') }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../utils/i18n'

interface ChartSeries {
  label: string
  points: Array<{ timestamp: number; value: number | null }>
  color: string
  fill?: boolean
}

const props = withDefaults(defineProps<{
  title: string
  values?: Array<number | null>
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
  points: props.values.map((value, index) => ({ timestamp: index, value })),
  color: props.color,
  fill: true,
}])

const allValues = computed(() => displaySeries.value
  .flatMap((item) => item.points.map((point) => point.value))
  .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)))
const hasValues = computed(() => allValues.value.length > 0)
const timestampRange = computed(() => {
  const timestamps = displaySeries.value
    .flatMap((item) => item.points.map((point) => point.timestamp))
    .filter(Number.isFinite)
  if (!timestamps.length) return { min: 0, max: 0 }
  return {
    min: Math.min(...timestamps),
    max: Math.max(...timestamps),
  }
})

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
  const duration = timestampRange.value.max - timestampRange.value.min
  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []

  for (const point of series.points) {
    if (point.value === null || !Number.isFinite(point.value) || !Number.isFinite(point.timestamp)) {
      if (current.length) segments.push(current)
      current = []
      continue
    }
    current.push({
      x: duration > 0 ? (point.timestamp - timestampRange.value.min) / duration * 320 : 160,
      y: 82 - Math.max(0, point.value) / scaleMax.value * 72,
    })
  }
  if (current.length) segments.push(current)

  return {
    ...series,
    fill: series.fill !== false,
    segments: segments.map((points) => {
      const linePoints = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
      return {
        linePoints,
        areaPoints: points.length > 1
          ? `${points[0]!.x.toFixed(1)},82 ${linePoints} ${points.at(-1)!.x.toFixed(1)},82`
          : '',
      }
    }),
  }
}))
</script>
