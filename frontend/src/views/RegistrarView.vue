<template>
  <div class="registrar-view">
    <div class="view-header">
      <h2>Registrar necesidad de insumos</h2>
      <p>Indica qué se necesita y marca tu ubicación en el mapa, con la búsqueda o con el GPS.</p>
    </div>

    <div class="registrar-layout">
      <section class="card form-card">
        <div class="field-group">
          <label for="title">Título del reporte</label>
          <input id="title" v-model="form.title" type="text" />
        </div>

        <div class="field-row">
          <div class="field-group">
            <label for="item">Insumo necesario</label>
            <input id="item" v-model="form.item" type="text" />
          </div>
          <div class="field-group">
            <label for="quantity">Cantidad</label>
            <input id="quantity" v-model="form.quantity" type="text" />
          </div>
        </div>

        <div class="field-row">
          <div class="field-group">
            <label for="state">Estado</label>
            <input id="state" v-model="form.state" type="text" readonly class="input-readonly" />
          </div>
          <div class="field-group">
            <label for="municipality">Municipio</label>
            <input id="municipality" v-model="form.municipality" type="text" readonly class="input-readonly" />
          </div>
        </div>

        <div class="field-group">
          <label for="locationName">Lugar exacto</label>
          <input id="locationName" v-model="form.locationName" type="text" />
          <p class="field-hint">Calle, referencia o punto cercano. Si no hay, se usa la ubicación del mapa.</p>
        </div>

        <div class="geo-section">
          <button type="button" class="btn btn-secondary btn-geo" @click="useMyLocation">
            Usar mi ubicación actual
          </button>
          <p v-if="locationMessage" class="info-msg" :class="{ warn: locationIsWarning }">{{ locationMessage }}</p>
          <p v-if="needsLocation" class="warn-msg">
            Marca un punto en el mapa, busca tu ciudad o usa tu ubicación actual.
          </p>
          <p v-if="hasCoords" class="coords-display">
            Coordenadas: {{ form.latitude }}, {{ form.longitude }}
          </p>
        </div>

        <div class="field-group">
          <label for="description">Descripción</label>
          <textarea id="description" v-model="form.description" rows="3"></textarea>
        </div>

        <p v-if="formError" class="error-msg" role="alert">{{ formError }}</p>
        <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

        <button class="btn btn-primary btn-register" :disabled="submitting" @click="submitReport">
          Registrar
        </button>
      </section>

      <section class="card map-card">
        <div class="map-card-head">
          <h3>Ubicación en el mapa</h3>
          <p class="map-hint">Busca con la lupa, haz clic para marcar o usa tu GPS.</p>
        </div>
        <div class="map-frame">
          <MapaVenezuela
            ref="mapRef"
            :reports="[]"
            :show-legend="false"
            :mostrar-buscador="true"
            :permitir-click="true"
            :encuadrar-venezuela="true"
            :selected-lat="form.latitude"
            :selected-lng="form.longitude"
            @ubicacion-seleccionada="onMapClick"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import MapaVenezuela from '../components/MapaVenezuela.vue'
import { createReport } from '../api/reports.js'
import { STATUS } from '../config/venezuela.js'
import {
  reverseGeocode,
  formatCoords,
  isSecureForGeolocation,
  geolocationErrorMessage
} from '../utils/geocoding.js'

const form = ref({
  title: '',
  item: '',
  quantity: '',
  state: '',
  municipality: '',
  locationName: '',
  latitude: '',
  longitude: '',
  description: ''
})
const locationMessage = ref('')
const locationIsWarning = ref(false)
const formError = ref('')
const successMsg = ref('')
const submitting = ref(false)
const geoAttempted = ref(false)
const mapRef = ref(null)

const hasCoords = computed(() => {
  const lat = Number(form.value.latitude)
  const lng = Number(form.value.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng)
})

const needsLocation = computed(() => geoAttempted.value && !hasCoords.value)

async function applyGeocodeResult(lat, lng, labelHint = '') {
  locationMessage.value = 'Obteniendo dirección...'
  try {
    const geo = await reverseGeocode(lat, lng)
    form.value.state = geo?.state || ''
    form.value.municipality = geo?.municipality || ''
    form.value.locationName =
      geo?.place || labelHint || geo?.displayName || formatCoords(lat, lng)
  } catch {
    form.value.state = ''
    form.value.locationName = labelHint || formatCoords(lat, lng)
  }
}

async function setUbicacion(lat, lng, origen, labelHint = '') {
  form.value.latitude = Number(lat).toFixed(6)
  form.value.longitude = Number(lng).toFixed(6)
  geoAttempted.value = true
  locationIsWarning.value = false

  await applyGeocodeResult(lat, lng, labelHint)

  locationMessage.value =
    origen === 'gps'
      ? 'Ubicación del dispositivo registrada.'
      : origen === 'busqueda'
        ? 'Ubicación encontrada en la búsqueda.'
        : 'Punto marcado en el mapa.'

  await nextTick()
  mapRef.value?.flyTo(lat, lng, origen === 'busqueda' ? 12 : 14)
  mapRef.value?.invalidateSize()
}

function useMyLocation() {
  geoAttempted.value = true
  locationIsWarning.value = false

  if (!isSecureForGeolocation()) {
    locationIsWarning.value = true
    locationMessage.value =
      'El GPS no funciona por HTTP en el celular. Usa la lupa del mapa para buscar tu ciudad o marca el punto.'
    return
  }

  if (!navigator.geolocation) {
    locationIsWarning.value = true
    locationMessage.value = 'Tu navegador no permite geolocalización. Usa la búsqueda del mapa.'
    return
  }

  locationMessage.value = 'Obteniendo ubicación...'

  navigator.geolocation.getCurrentPosition(
    (pos) => setUbicacion(pos.coords.latitude, pos.coords.longitude, 'gps'),
    (err) => {
      locationIsWarning.value = true
      locationMessage.value = geolocationErrorMessage(err)
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  )
}

function onMapClick({ lat, lng, label }) {
  const origen = label ? 'busqueda' : 'mapa'
  setUbicacion(lat, lng, origen, label || '')
}

async function submitReport() {
  formError.value = ''
  successMsg.value = ''

  if (!form.value.title || !form.value.item) {
    formError.value = 'Completa título e insumo.'
    return
  }

  geoAttempted.value = true
  if (!hasCoords.value) {
    formError.value = 'Indica la ubicación con el GPS, la búsqueda o marcando el mapa.'
    return
  }

  if (!form.value.locationName.trim()) {
    form.value.locationName = formatCoords(form.value.latitude, form.value.longitude)
  }

  if (!form.value.state.trim() && hasCoords.value) {
    await applyGeocodeResult(form.value.latitude, form.value.longitude)
  }

  submitting.value = true
  try {
    await createReport({ ...form.value, status: STATUS.NEEDING })
    form.value = {
      title: '',
      item: '',
      quantity: '',
      state: '',
      municipality: '',
      locationName: '',
      latitude: '',
      longitude: '',
      description: ''
    }
    locationMessage.value = ''
    geoAttempted.value = false
    successMsg.value = 'Reporte registrado correctamente. Ve a Reportes para ver su estado.'
  } catch {
    formError.value = 'No se pudo guardar. ¿Está el backend corriendo en el puerto 3001?'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await nextTick()
  setTimeout(() => mapRef.value?.invalidateSize(), 200)
  if (isSecureForGeolocation()) {
    useMyLocation()
  } else {
    locationIsWarning.value = true
    locationMessage.value =
      'Para usar GPS entra por localhost o HTTPS. Mientras tanto, busca tu ciudad con la lupa del mapa.'
  }
})
</script>

<style scoped>
.registrar-layout {
  display: grid;
  grid-template-columns: minmax(320px, 420px) 1fr;
  gap: 20px;
  align-items: start;
}
.form-card { display: flex; flex-direction: column; }
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field-hint {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: #64748b;
}
.input-readonly {
  background: #f1f5f9;
  color: #334155;
  font-weight: 600;
}
.geo-section { margin-bottom: 14px; }
.btn-geo { width: 100%; }
.info-msg.warn { color: #b45309; background: #fffbeb; padding: 8px 10px; border-radius: 8px; }
.coords-display {
  margin: 8px 0 0;
  font-size: 0.8rem;
  color: #475569;
  font-family: ui-monospace, monospace;
  word-break: break-all;
}
.btn-register {
  width: 100%;
  margin-top: 4px;
  padding: 14px;
  font-size: 1rem;
}
.map-card {
  display: flex;
  flex-direction: column;
  min-height: 520px;
  padding: 16px;
}
.map-card-head { margin-bottom: 12px; flex-shrink: 0; }
.map-card-head h3 { margin: 0 0 4px; font-size: 1.05rem; }
.map-hint { margin: 0; font-size: 0.85rem; color: #64748b; }
.map-frame {
  flex: 1;
  min-height: 460px;
  height: 460px;
  position: relative;
  overflow: hidden;
}

@media (max-width: 960px) {
  .registrar-layout { grid-template-columns: 1fr; }
  .map-card { order: -1; min-height: auto; }
  .map-frame { min-height: 340px; height: 340px; }
  .field-row { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .map-frame { min-height: 280px; height: 280px; }
}
</style>
