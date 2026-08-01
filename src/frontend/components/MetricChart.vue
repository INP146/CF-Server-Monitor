<template>
  <div class="metric-chart" :class="{ 'is-empty': !hasValues }">
    <template v-if="hasValues">
      <div v-if="displaySeries.length > 1" class="metric-chart-legend" :aria-label="t('chartLegend')">
        <button
          v-for="(item, index) in displaySeries"
          :key="`${item.label}-${index}`"
          type="button"
          :class="{ 'is-hidden': hiddenSeries.has(index) }"
          :aria-pressed="!hiddenSeries.has(index)"
          @click="toggleSeries(index)"
        >
          <i :style="{ background: item.color }" />
          <span>{{ item.label }}</span>
        </button>
      </div>
      <div class="metric-chart-canvas">
        <canvas ref="canvasRef" role="img" :aria-label="t('trendChart', { title })" />
      </div>
    </template>
    <span v-else>{{ t('noData') }}</span>
  </div>
</template>

<script setup lang="ts">
import Chart from 'chart.js/auto'
import type { ChartDataset, ChartOptions, Plugin, TooltipItem } from 'chart.js'
import 'chartjs-adapter-date-fns'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { resolvedTheme } from '../composables/useTheme'
import {
  formatChartTimestamp,
  formatChartTimeTick,
  formatChartValue,
  getChartTimeUnit,
  insertChartGapBreaks,
  type ChartPoint,
  type ChartValueFormat,
} from '../utils/chart'
import { t } from '../utils/i18n'

interface ChartSeries {
  label: string
  points: ChartPoint[]
  color: string
  fill?: boolean
}

type CanvasPoint = { x: number; y: number | null }

const props = withDefaults(defineProps<{
  title: string
  values?: Array<number | null>
  color?: string
  unit?: string
  series?: ChartSeries[]
  valueFormat?: ChartValueFormat
}>(), {
  values: () => [],
  color: '#1677ff',
  unit: '',
  series: () => [],
  valueFormat: 'number',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hiddenSeries = ref(new Set<number>())
let chart: Chart<'line', CanvasPoint[]> | null = null

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
  if (!timestamps.length) return { min: 0, max: 0, duration: 0 }
  const min = Math.min(...timestamps)
  const max = Math.max(...timestamps)
  return { min, max, duration: max - min }
})

const hoverLine: Plugin<'line'> = {
  id: 'metric-hover-line',
  afterDraw(currentChart) {
    const active = currentChart.tooltip?.getActiveElements()
    if (!active?.length) return
    const x = active[0]!.element.x
    const { ctx, chartArea } = currentChart
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = resolvedTheme.value === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)'
    ctx.stroke()
    ctx.restore()
  },
}

function createDatasets(): ChartDataset<'line', CanvasPoint[]>[] {
  return displaySeries.value.map((item, index) => ({
    label: item.label,
    data: insertChartGapBreaks(item.points, timestampRange.value.duration).map((point) => ({
      x: point.timestamp,
      y: point.value,
    })),
    borderColor: item.color,
    backgroundColor: item.fill === false ? 'transparent' : `${item.color}14`,
    fill: item.fill !== false,
    hidden: hiddenSeries.value.has(index),
    borderWidth: 1.75,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointHitRadius: 12,
    spanGaps: false,
    tension: 0.28,
  }))
}

function createOptions(): ChartOptions<'line'> {
  const isDark = resolvedTheme.value === 'dark'
  const axisColor = isDark ? '#a3a3a3' : '#737373'
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.075)' : 'rgba(0, 0, 0, 0.065)'
  const duration = timestampRange.value.duration

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 180 },
    normalized: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: true,
        backgroundColor: isDark ? 'rgba(20, 20, 20, 0.96)' : 'rgba(255, 255, 255, 0.98)',
        titleColor: isDark ? '#f5f5f5' : '#262626',
        bodyColor: isDark ? '#d4d4d4' : '#525252',
        borderColor: isDark ? '#404040' : '#d9d9d9',
        borderWidth: 1,
        cornerRadius: 4,
        padding: 10,
        callbacks: {
          title(items: TooltipItem<'line'>[]) {
            const timestamp = items[0]?.parsed.x
            return typeof timestamp === 'number' ? formatChartTimestamp(timestamp) : ''
          },
          label(item: TooltipItem<'line'>) {
            const value = item.parsed.y
            const formatted = typeof value === 'number'
              ? formatChartValue(value, props.unit, props.valueFormat)
              : t('noData')
            return `${item.dataset.label || props.title}: ${formatted}`
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        min: timestampRange.value.min,
        max: timestampRange.value.max,
        time: { unit: getChartTimeUnit(duration) },
        grid: { color: gridColor, tickLength: 0 },
        border: { display: false },
        ticks: {
          color: axisColor,
          maxTicksLimit: 6,
          maxRotation: 0,
          autoSkipPadding: 16,
          padding: 8,
          font: { size: 10 },
          callback(value) {
            return formatChartTimeTick(Number(value), duration)
          },
        },
      },
      y: {
        beginAtZero: true,
        grace: '8%',
        grid: { color: gridColor, tickLength: 0 },
        border: { display: false },
        ticks: {
          color: axisColor,
          maxTicksLimit: 5,
          padding: 8,
          font: { size: 10 },
          callback(value) {
            return formatChartValue(Number(value), props.unit, props.valueFormat)
          },
        },
      },
    },
  }
}

function destroyChart() {
  chart?.destroy()
  chart = null
}

function syncChart() {
  if (!hasValues.value || !canvasRef.value) {
    destroyChart()
    return
  }
  if (!chart) {
    chart = new Chart<'line', CanvasPoint[]>(canvasRef.value, {
      type: 'line',
      data: { datasets: createDatasets() },
      options: createOptions(),
      plugins: [hoverLine],
    })
    return
  }
  chart.data.datasets = createDatasets()
  chart.options = createOptions()
  chart.update('none')
}

function toggleSeries(index: number) {
  const next = new Set(hiddenSeries.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  hiddenSeries.value = next
  chart?.setDatasetVisibility(index, !next.has(index))
  chart?.update()
}

watch(
  () => [props.title, props.unit, props.valueFormat, props.series, props.values, resolvedTheme.value],
  () => { void nextTick(syncChart) },
  { deep: true, flush: 'post' },
)
onMounted(() => { void nextTick(syncChart) })
onBeforeUnmount(destroyChart)
</script>
