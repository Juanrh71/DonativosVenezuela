<template>
  <div ref="wrapperRef" class="mapa-wrapper">
    <div v-if="mostrarBuscador" class="mapa-buscar">
      <form class="buscar-form" @submit.prevent="ejecutarBusqueda">
        <span class="buscar-icono" aria-hidden="true"></span>
        <input
          v-model="textoBusqueda"
          type="search"
          class="buscar-input"
          placeholder="Buscar ciudad, estado o lugar…"
          autocomplete="off"
          aria-label="Buscar en el mapa"
          :disabled="buscando"
        />
        <button type="submit" class="buscar-btn" :disabled="buscando || !textoBusqueda.trim()">
          {{ buscando ? '…' : 'Ir' }}
        </button>
      </form>
      <p v-if="mensajeBusqueda" class="buscar-msg" :class="{ error: busquedaError }">{{ mensajeBusqueda }}</p>
    </div>
    <div ref="mapContainer" class="mapa-container"></div>
    <div v-if="loading" class="mapa-loading">Cargando mapa...</div>
    <div v-if="showLegend" class="mapa-leyenda" aria-label="Leyenda del mapa">
      <div class="leyenda-item">
        <i class="dot dot--red"></i>
        <span>Necesitando</span>
        <strong>{{ counts.Necesitando }}</strong>
      </div>
      <div class="leyenda-item">
        <i class="dot dot--yellow"></i>
        <span>En proceso</span>
        <strong>{{ counts['En proceso'] }}</strong>
      </div>
      <div class="leyenda-item">
        <i class="dot dot--green"></i>
        <span>Entregado</span>
        <strong>{{ counts.Entregado }}</strong>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MAPA_CENTRO_VENEZUELA,
  MAPA_ZOOM_DEFAULT,
  MAPA_BOUNDS_VENEZUELA,
  STATUS_COLORS
} from '../config/venezuela.js'
import { searchPlace } from '../utils/geocoding.js'

const props = defineProps({
  reports: { type: Array, default: () => [] },
  showLegend: { type: Boolean, default: true },
  permitirClick: { type: Boolean, default: false },
  mostrarBuscador: { type: Boolean, default: false },
  encuadrarVenezuela: { type: Boolean, default: true },
  selectedLat: { type: [Number, String], default: null },
  selectedLng: { type: [Number, String], default: null }
})

const emit = defineEmits(['ubicacion-seleccionada'])

const wrapperRef = ref(null)
const mapContainer = ref(null)
const loading = ref(true)
const textoBusqueda = ref('')
const buscando = ref(false)
const mensajeBusqueda = ref('')
const busquedaError = ref(false)

let map = null
let layerGroup = null
let selectedMarker = null
let resizeObserver = null

const boundsVenezuela = L.latLngBounds(MAPA_BOUNDS_VENEZUELA)

const counts = computed(() => {
  const c = { Necesitando: 0, 'En proceso': 0, Entregado: 0 }
  for (const r of props.reports) {
    const s = normalizeStatus(r.status)
    if (c[s] != null) c[s] += 1
  }
  return c
})

function normalizeStatus(status) {
  if (status === 'Necesita') return 'Necesitando'
  return status || 'Necesitando'
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function crearIcono(status) {
  const color = STATUS_COLORS[normalizeStatus(status)] || '#64748b'
  const html = `<span style="background:${color};width:14px;height:14px;border-radius:50%;display:block;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></span>`
  return L.divIcon({
    className: 'marker-reporte',
    html,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  })
}

function crearIconoSeleccion() {
  const html = `<span style="background:#2563eb;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:block;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></span>`
  return L.divIcon({
    className: 'marker-seleccion',
    html,
    iconSize: [22, 22],
    iconAnchor: [11, 22]
  })
}

function centrarEnVenezuela() {
  if (!map) return
  map.fitBounds(boundsVenezuela, { padding: [20, 20], maxZoom: 7, animate: false })
}

function actualizarMarcadores() {
  if (!map || !layerGroup) return
  layerGroup.clearLayers()

  for (const report of props.reports) {
    const lat = Number(report.latitude)
    const lng = Number(report.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const marker = L.marker([lat, lng], { icon: crearIcono(report.status) })
    let popup = `<strong>${escHtml(report.title)}</strong><br>`
    popup += `<span style="color:${STATUS_COLORS[normalizeStatus(report.status)]};font-weight:700">${escHtml(normalizeStatus(report.status))}</span><br>`
    popup += `Insumo: ${escHtml(report.item)}`
    if (report.quantity) popup += ` · ${escHtml(report.quantity)}`
    popup += `<br>Zona: ${escHtml(report.locationName)}`
    if (report.description) popup += `<br>${escHtml(report.description)}`
    marker.bindPopup(popup)
    layerGroup.addLayer(marker)
  }

  actualizarMarcadorSeleccion()
}

function actualizarMarcadorSeleccion() {
  if (!map) return
  if (selectedMarker) {
    map.removeLayer(selectedMarker)
    selectedMarker = null
  }
  const lat = Number(props.selectedLat)
  const lng = Number(props.selectedLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
  selectedMarker = L.marker([lat, lng], { icon: crearIconoSeleccion() }).addTo(map)
}

function flyTo(lat, lng, zoom = 14) {
  if (!map) return
  const parsedLat = Number(lat)
  const parsedLng = Number(lng)
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return
  map.flyTo([parsedLat, parsedLng], zoom, { duration: 0.8 })
  actualizarMarcadorSeleccion()
}

async function ejecutarBusqueda() {
  const q = textoBusqueda.value.trim()
  if (!q || !map) return
  buscando.value = true
  busquedaError.value = false
  mensajeBusqueda.value = ''
  try {
    const r = await searchPlace(q)
    if (!r) {
      busquedaError.value = true
      mensajeBusqueda.value = 'No se encontró el lugar. Prueba con otro nombre.'
      return
    }
    if (r.bounds) {
      map.fitBounds(L.latLngBounds(r.bounds), { maxZoom: 14, padding: [40, 40], animate: true })
    } else {
      map.flyTo([r.lat, r.lng], r.zoom || 12, { duration: 0.75 })
    }
    emit('ubicacion-seleccionada', { lat: r.lat, lng: r.lng, label: r.label || q })
    mensajeBusqueda.value = ''
  } catch {
    busquedaError.value = true
    mensajeBusqueda.value = 'Error al buscar. Verifica que el backend esté corriendo.'
  } finally {
    buscando.value = false
  }
}

function refrescarMapa(encuadrar = props.encuadrarVenezuela) {
  if (!map) return
  map.invalidateSize({ pan: false })
  if (encuadrar) {
    centrarEnVenezuela()
  }
  actualizarMarcadores()
}

onMounted(() => {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value, {
    center: [MAPA_CENTRO_VENEZUELA.lat, MAPA_CENTRO_VENEZUELA.lng],
    zoom: MAPA_ZOOM_DEFAULT,
    minZoom: 5,
    maxBounds: boundsVenezuela.pad(0.5),
    maxBoundsViscosity: 0.85
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map)

  layerGroup = L.layerGroup().addTo(map)

  if (props.permitirClick) {
    map.on('click', (e) => {
      emit('ubicacion-seleccionada', { lat: e.latlng.lat, lng: e.latlng.lng })
    })
  }

  if (wrapperRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      refrescarMapa(props.encuadrarVenezuela)
    })
    resizeObserver.observe(wrapperRef.value)
  }

  nextTick(() => {
    refrescarMapa(true)
    setTimeout(() => refrescarMapa(true), 100)
    setTimeout(() => refrescarMapa(true), 350)
    loading.value = false
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (map) {
    map.remove()
    map = null
  }
})

watch(() => props.reports, actualizarMarcadores, { deep: true })
watch(() => [props.selectedLat, props.selectedLng], actualizarMarcadorSeleccion)

defineExpose({
  invalidateSize: () => refrescarMapa(props.encuadrarVenezuela),
  flyTo,
  centrarEnVenezuela
})
</script>

<style scoped>
.mapa-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 280px;
}
.mapa-container {
  width: 100%;
  height: 100%;
  min-height: 280px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #e2e8f0;
  z-index: 1;
}
.mapa-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 500;
}
.mapa-leyenda {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 160px;
}
.leyenda-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #334155;
}
.leyenda-item strong {
  margin-left: auto;
  font-size: 1rem;
  color: #0f172a;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(15, 23, 42, 0.2);
  flex-shrink: 0;
}
.dot--red { background: #dc2626; }
.dot--yellow { background: #f59e0b; }
.dot--green { background: #10b981; }
:deep(.marker-reporte),
:deep(.marker-seleccion) {
  background: transparent !important;
  border: none !important;
}
:deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  font-family: inherit;
}
.mapa-buscar {
  position: absolute;
  z-index: 1000;
  left: 12px;
  top: 12px;
  width: min(360px, calc(100% - 24px));
  pointer-events: none;
}
.mapa-buscar * { pointer-events: auto; }
.buscar-form {
  display: flex;
  align-items: stretch;
  background: #fff;
  border-radius: 999px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}
.buscar-icono {
  flex-shrink: 0;
  width: 2.75rem;
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'/%3E%3C/svg%3E") center / 1.15rem no-repeat;
}
.buscar-input {
  flex: 1;
  border: none;
  padding: 0.55rem 0.35rem 0.55rem 0;
  font-size: 0.9rem;
  min-width: 0;
  outline: none;
}
.buscar-btn {
  flex-shrink: 0;
  border: none;
  padding: 0 1.1rem;
  font-size: 0.875rem;
  font-weight: 600;
  background: #00247d;
  color: #fff;
  cursor: pointer;
}
.buscar-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.buscar-msg {
  margin: 6px 16px 0;
  font-size: 0.78rem;
  text-align: center;
  color: #475569;
  text-shadow: 0 1px 2px #fff;
}
.buscar-msg.error { color: #b91c1c; }
</style>
