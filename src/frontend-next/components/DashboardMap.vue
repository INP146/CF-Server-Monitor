<template>
  <div class="dashboard-map-shell">
    <div ref="mapElement" class="dashboard-map" :aria-label="t('mapLabel')" />
    <a-alert v-if="error" type="error" show-icon :message="error" class="dashboard-map-error">
      <template #action><a-button size="small" @click="initialize">{{ t('retry') }}</a-button></template>
    </a-alert>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AAlert from 'ant-design-vue/es/alert'
import AButton from 'ant-design-vue/es/button'
import { getPublicAssetUrl } from '../utils/config'
import { t } from '../utils/i18n'

type LeafletLayer = { addTo: (target: LeafletMap | LeafletLayer) => LeafletLayer }
type LeafletMap = {
  remove: () => void
  removeLayer: (layer: LeafletLayer) => void
  invalidateSize: () => void
}
type LeafletApi = {
  map: (element: HTMLElement, options: Record<string, unknown>) => LeafletMap & { setView: (center: number[], zoom: number) => LeafletMap }
  control: { zoom: (options: Record<string, unknown>) => LeafletLayer }
  geoJSON: (data: unknown, options: Record<string, unknown>) => LeafletLayer
  layerGroup: () => LeafletLayer & { clearLayers: () => void }
  divIcon: (options: Record<string, unknown>) => unknown
  marker: (coordinates: number[], options: Record<string, unknown>) => LeafletLayer & { bindTooltip: (content: string) => LeafletLayer }
}

declare global {
  interface Window { L?: LeafletApi }
}

const props = defineProps<{
  regions: Record<string, number>
  isDark: boolean
}>()

const REGION_COORDINATES: Record<string, number[]> = {
  US: [37.09, -95.71], CN: [35.86, 104.19], JP: [36.20, 138.25], HK: [22.31, 114.16],
  SG: [1.35, 103.81], KR: [35.90, 127.76], DE: [51.16, 10.45], GB: [55.37, -3.43],
  NL: [52.13, 5.29], FR: [46.22, 2.21], CA: [56.13, -106.34], AU: [-25.27, 133.77],
  IN: [20.59, 78.96], BR: [-14.23, -51.92], RU: [61.52, 105.31], ZA: [-30.55, 22.93],
  TW: [23.69, 120.96], IT: [41.87, 12.56], SE: [60.12, 18.64], CH: [46.81, 8.22],
  ES: [40.46, -3.74], PL: [51.91, 19.14], FI: [61.92, 25.74], NO: [60.47, 8.46],
  DK: [56.26, 9.50], IE: [53.14, -7.69], AT: [47.51, 14.55], TR: [38.96, 35.24],
  AE: [23.42, 53.84], MY: [4.21, 101.97], TH: [15.87, 100.99], VN: [14.05, 108.27],
  PH: [12.87, 121.77], ID: [-0.78, 113.92], MO: [22.2, 113.54],
}

let leafletPromise: Promise<LeafletApi> | null = null
let leafletStylesheetPromise: Promise<void> | null = null
let worldPromise: Promise<unknown> | null = null

function loadLeafletStylesheet(): Promise<void> {
  let existing = document.querySelector<HTMLLinkElement>('link[data-edgeprobe-leaflet]')
  if (existing?.dataset.edgeprobeState === 'loaded' || existing?.sheet) return Promise.resolve()
  if (leafletStylesheetPromise) return leafletStylesheetPromise
  if (existing?.dataset.edgeprobeState === 'error') {
    existing.remove()
    existing = null
  }

  const stylesheet = existing ?? document.createElement('link')
  const promise = new Promise<void>((resolve, reject) => {
    stylesheet.addEventListener('load', () => {
      stylesheet.dataset.edgeprobeState = 'loaded'
      resolve()
    }, { once: true })
    stylesheet.addEventListener('error', () => {
      stylesheet.dataset.edgeprobeState = 'error'
      stylesheet.remove()
      reject(new Error(t('mapStyleFailed')))
    }, { once: true })
    if (!existing) {
      stylesheet.rel = 'stylesheet'
      stylesheet.href = getPublicAssetUrl('leaflet.css')
      stylesheet.dataset.edgeprobeLeaflet = 'true'
      document.head.appendChild(stylesheet)
    }
  })
  leafletStylesheetPromise = promise
  void promise.catch(() => { if (leafletStylesheetPromise === promise) leafletStylesheetPromise = null })
  return promise
}

function loadLeaflet(): Promise<LeafletApi> {
  const stylesheet = loadLeafletStylesheet()
  if (window.L) return stylesheet.then(() => window.L!)
  if (leafletPromise) return Promise.all([stylesheet, leafletPromise]).then(([, api]) => api)

  const promise = new Promise<LeafletApi>((resolve, reject) => {
    let existing = document.querySelector<HTMLScriptElement>('script[data-edgeprobe-leaflet]')
    if (existing?.dataset.edgeprobeState === 'loaded' || existing?.dataset.edgeprobeState === 'error') {
      existing.remove()
      existing = null
    }
    const script = existing ?? document.createElement('script')
    const fail = () => {
      script.dataset.edgeprobeState = 'error'
      script.remove()
      reject(new Error(t('mapComponentFailed')))
    }
    script.addEventListener('load', () => {
      script.dataset.edgeprobeState = 'loaded'
      if (window.L) resolve(window.L)
      else fail()
    }, { once: true })
    script.addEventListener('error', fail, { once: true })
    if (!existing) {
      script.src = getPublicAssetUrl('leaflet.js')
      script.async = true
      script.dataset.edgeprobeLeaflet = 'true'
      document.head.appendChild(script)
    }
  })
  leafletPromise = promise
  void promise.catch(() => { if (leafletPromise === promise) leafletPromise = null })
  return Promise.all([stylesheet, promise]).then(([, api]) => api)
}

function loadWorld(): Promise<unknown> {
  if (worldPromise) return worldPromise
  const promise = fetch(getPublicAssetUrl('world.zh.json')).then((response) => {
    if (!response.ok) throw new Error(t('mapDataFailed'))
    return response.json()
  })
  worldPromise = promise
  void promise.catch(() => { if (worldPromise === promise) worldPromise = null })
  return promise
}

const mapElement = ref<HTMLElement | null>(null)
const error = ref('')
let leaflet: LeafletApi | null = null
let map: LeafletMap | null = null
let countries: LeafletLayer | null = null
let markers: (LeafletLayer & { clearLayers: () => void }) | null = null
let worldData: unknown = null
let initializeRun = 0

function draw() {
  if (!leaflet || !map || !worldData) return
  if (countries) map.removeLayer(countries)
  if (markers) markers.clearLayers()
  else markers = leaflet.layerGroup() as LeafletLayer & { clearLayers: () => void }
  markers.addTo(map)

  const active = new Set(Object.keys(props.regions).map((region) => region.toUpperCase()))
  if (active.has('HK') || active.has('TW') || active.has('MO')) active.add('CN')
  const colors = props.isDark
    ? { active: '#f38020', inactive: '#30363d', border: '#101214', text: '#ffffff' }
    : { active: '#f38020', inactive: '#e5e7eb', border: '#ffffff', text: '#171717' }

  countries = leaflet.geoJSON(worldData, {
    style: (feature: { properties?: { iso_a2?: string } }) => ({
      fillColor: active.has(String(feature.properties?.iso_a2 || '').toUpperCase()) ? colors.active : colors.inactive,
      weight: 1,
      opacity: 0.8,
      color: colors.border,
      fillOpacity: active.has(String(feature.properties?.iso_a2 || '').toUpperCase()) ? 0.38 : 0.24,
    }),
  }).addTo(map)

  for (const [rawCode, rawCount] of Object.entries(props.regions)) {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9-]/g, '')
    const coordinates = REGION_COORDINATES[code]
    const count = Math.max(0, Math.floor(Number(rawCount) || 0))
    if (!coordinates || !count) continue
    const icon = leaflet.divIcon({
      className: 'dashboard-map-marker',
      html: `<span>${count}</span>`,
      iconSize: [28, 28],
    })
    leaflet.marker(coordinates, { icon }).bindTooltip(`${code} · ${t('nodeCount', { count })}`).addTo(markers)
  }
  window.requestAnimationFrame(() => map?.invalidateSize())
}

async function initialize() {
  const currentRun = ++initializeRun
  map?.remove()
  map = null
  countries = null
  markers = null
  try {
    error.value = ''
    await nextTick()
    if (!mapElement.value) return
    const [loadedLeaflet, loadedWorld] = await Promise.all([loadLeaflet(), loadWorld()])
    if (currentRun !== initializeRun || !mapElement.value) return
    leaflet = loadedLeaflet
    worldData = loadedWorld
    map = leaflet.map(mapElement.value, { zoomControl: false, attributionControl: false, minZoom: 1 })
      .setView(window.innerWidth < 768 ? [35, 105] : [30, 10], window.innerWidth < 768 ? 1 : 2)
    leaflet.control.zoom({ position: 'bottomright' }).addTo(map)
    draw()
  } catch (caught) {
    if (currentRun !== initializeRun) return
    error.value = caught instanceof Error ? caught.message : t('mapLoadFailed')
  }
}

watch(() => [props.regions, props.isDark] as const, draw, { deep: true })
onMounted(() => { void initialize() })
onBeforeUnmount(() => { initializeRun += 1; map?.remove(); map = null })
</script>
