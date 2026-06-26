<template>
  <div class="view mapa-view">
    <div class="view-header">
      <h2>Mapa en vivo — Venezuela</h2>
      <p>Visualiza en tiempo real las necesidades de insumos en todo el país.</p>
    </div>

    <div class="status-bar card">
      <span>
        Reportes visibles: <strong>{{ reports.length }}</strong>
      </span>
      <span v-if="actualizando" class="polling">Actualizando…</span>
      <span v-else class="polling muted">Última actualización: {{ ultimaActualizacionTexto }}</span>
    </div>

    <p v-if="errorCarga" class="error-msg" role="alert">{{ errorCarga }}</p>

    <div class="counts-bar">
      <div class="count-chip count-chip--red">
        <span class="count-num">{{ counts.Necesitando }}</span>
        <span>Necesitando</span>
      </div>
      <div class="count-chip count-chip--yellow">
        <span class="count-num">{{ counts['En proceso'] }}</span>
        <span>En proceso</span>
      </div>
      <div class="count-chip count-chip--green">
        <span class="count-num">{{ counts.Entregado }}</span>
        <span>Entregado</span>
      </div>
    </div>

    <div class="mapa-box card">
      <MapaVenezuela
        ref="mapRef"
        :reports="reportsWithCoords"
        :show-legend="true"
        :mostrar-buscador="true"
        :encuadrar-venezuela="true"
      />
    </div>

    <div class="leyenda-card card">
      <h3>Leyenda del mapa</h3>
      <div class="leyenda-grid">
        <div class="leyenda-row">
          <i class="dot dot--red"></i>
          <span>Rojo — Necesitando ayuda</span>
          <strong>{{ counts.Necesitando }}</strong>
        </div>
        <div class="leyenda-row">
          <i class="dot dot--yellow"></i>
          <span>Amarillo — En proceso de entrega</span>
          <strong>{{ counts['En proceso'] }}</strong>
        </div>
        <div class="leyenda-row">
          <i class="dot dot--green"></i>
          <span>Verde — Entregado</span>
          <strong>{{ counts.Entregado }}</strong>
        </div>
      </div>
    </div>

    <section class="card reports-live">
      <h3>Reportes en el mapa</h3>
      <p class="helper-text">Para marcar un reporte en proceso o entregado, ve a la sección <RouterLink to="/reportes">Reportes</RouterLink>.</p>
      <div class="reports-list">
        <article v-for="report in reports" :key="report.id" class="report-row">
          <span class="dot-inline" :class="dotClass(report.status)"></span>
          <div class="report-info">
            <strong>{{ report.title }}</strong>
            <span>{{ report.item }} · {{ report.locationName }}</span>
          </div>
          <span class="badge" :class="badgeClass(report.status)">{{ normalizeStatus(report.status) }}</span>
        </article>
        <p v-if="!reports.length" class="empty-msg">No hay reportes aún. Registra una necesidad.</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import MapaVenezuela from '../components/MapaVenezuela.vue'
import { fetchReports } from '../api/reports.js'

const reports = ref([])
const actualizando = ref(false)
const ultimaActualizacion = ref(null)
const errorCarga = ref('')
const mapRef = ref(null)

const INTERVALO_MS = 8000
let intervalId = null

function normalizeStatus(status) {
  if (status === 'Necesita') return 'Necesitando'
  return status || 'Necesitando'
}

const counts = computed(() => {
  const c = { Necesitando: 0, 'En proceso': 0, Entregado: 0 }
  for (const r of reports.value) {
    const s = normalizeStatus(r.status)
    if (c[s] != null) c[s] += 1
  }
  return c
})

const reportsWithCoords = computed(() =>
  reports.value.filter((r) => {
    const lat = Number(r.latitude)
    const lng = Number(r.longitude)
    return Number.isFinite(lat) && Number.isFinite(lng)
  })
)

const ultimaActualizacionTexto = computed(() => {
  const u = ultimaActualizacion.value
  if (!u) return '—'
  return u.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})

function badgeClass(status) {
  const s = normalizeStatus(status)
  return { Necesitando: 'badge-red', 'En proceso': 'badge-yellow', Entregado: 'badge-green' }[s]
}

function dotClass(status) {
  const s = normalizeStatus(status)
  return { Necesitando: 'dot-inline--red', 'En proceso': 'dot-inline--yellow', Entregado: 'dot-inline--green' }[s]
}

async function refrescar() {
  actualizando.value = true
  try {
    reports.value = await fetchReports()
    errorCarga.value = ''
    ultimaActualizacion.value = new Date()
    mapRef.value?.invalidateSize?.()
  } catch {
    errorCarga.value = 'No se pudo cargar el mapa. Verifica que el backend esté corriendo.'
  } finally {
    actualizando.value = false
  }
}

onMounted(async () => {
  await refrescar()
  intervalId = setInterval(refrescar, INTERVALO_MS)
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.status-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 12px 16px;
  margin-bottom: 12px;
}
.polling { font-size: 0.85rem; color: #2563eb; }
.polling.muted { color: #64748b; }
.counts-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.count-chip {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
}
.count-num { font-size: 2rem; font-weight: 800; line-height: 1; }
.count-chip--red .count-num { color: #dc2626; }
.count-chip--yellow .count-num { color: #d97706; }
.count-chip--green .count-num { color: #059669; }
.mapa-box {
  padding: 8px;
  height: 480px;
  min-height: 480px;
  margin-bottom: 16px;
  overflow: hidden;
}
.mapa-box :deep(.mapa-wrapper) {
  height: 100%;
  min-height: 460px;
}
.leyenda-card h3 { margin: 0 0 10px; font-size: 0.95rem; }
.leyenda-grid { display: flex; flex-direction: column; gap: 8px; }
.leyenda-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: #475569;
}
.leyenda-row strong { margin-left: auto; font-size: 1.1rem; color: #0f172a; }
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--red { background: #dc2626; }
.dot--yellow { background: #f59e0b; }
.dot--green { background: #10b981; }
.reports-live h3 { margin-top: 0; }
.reports-list { display: flex; flex-direction: column; gap: 10px; }
.report-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}
.report-info {
  flex: 1;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.report-info span { font-size: 0.85rem; color: #64748b; }
.dot-inline {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-inline--red { background: #dc2626; }
.dot-inline--yellow { background: #f59e0b; }
.dot-inline--green { background: #10b981; }
.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.empty-msg { color: #64748b; text-align: center; padding: 20px; }

@media (max-width: 600px) {
  .report-row { flex-direction: column; align-items: flex-start; }
  .row-actions { width: 100%; }
}
</style>
