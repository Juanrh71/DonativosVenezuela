<template>
  <div class="view reportes-view">
    <div class="view-header">
      <h2>Reportes de insumos</h2>
      <p>Consulta el estado de cada necesidad. Si vas a llevar donativos, márcalo en proceso; al entregar, confírmalo aquí.</p>
    </div>

    <div class="filters card">
      <button
        v-for="f in filtros"
        :key="f.value"
        class="filter-btn"
        :class="{ active: filtroActivo === f.value }"
        @click="filtroActivo = f.value"
      >
        {{ f.label }}
        <span class="filter-count">{{ conteoPorFiltro(f.value) }}</span>
      </button>
    </div>

    <p v-if="errorCarga" class="error-msg" role="alert">{{ errorCarga }}</p>
    <p v-if="mensajeOk" class="success-msg">{{ mensajeOk }}</p>

    <div class="reportes-list">
      <article v-for="report in reportesFiltrados" :key="report.id" class="report-card card">
        <div class="report-top">
          <div>
            <h3>{{ report.title }}</h3>
            <p class="report-meta">
              <strong>{{ report.item }}</strong>
              <span v-if="report.quantity"> · {{ report.quantity }}</span>
            </p>
          </div>
          <span class="badge" :class="badgeClass(report.status)">
            {{ statusLabel(report.status) }}
          </span>
        </div>

        <p class="report-zone">
          <span class="state-tag">{{ report.state || 'Sin estado' }}</span>
          · {{ report.locationName || 'Sin referencia' }}
        </p>
        <p v-if="report.description" class="report-desc">{{ report.description }}</p>
        <p class="report-date">Registrado: {{ formatDate(report.createdAt) }}</p>

        <div class="status-info" :class="infoClass(report.status)">
          <template v-if="normalizeStatus(report.status) === 'Necesitando'">
            Esta zona aún necesita ayuda. ¿Puedes llevar los insumos?
          </template>
          <template v-else-if="normalizeStatus(report.status) === 'En proceso'">
            Alguien está llevando los donativos. Confirma cuando se hayan entregado.
          </template>
          <template v-else>
            La ayuda ya fue entregada en esta zona.
          </template>
        </div>

        <div v-if="normalizeStatus(report.status) !== 'Entregado'" class="report-actions">
          <button
            v-if="normalizeStatus(report.status) === 'Necesitando'"
            class="btn btn-warning"
            :disabled="actualizando === report.id"
            @click="marcarEnProceso(report.id)"
          >
            Sí, voy a llevar los donativos
          </button>
          <button
            v-if="normalizeStatus(report.status) === 'En proceso'"
            class="btn btn-success"
            :disabled="actualizando === report.id"
            @click="marcarEntregado(report.id)"
          >
            Marcar como entregado
          </button>
        </div>
      </article>

      <p v-if="!reportesFiltrados.length && !errorCarga" class="empty-msg card">
        No hay reportes{{ filtroActivo !== 'todos' ? ' con este estado' : '' }}.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchReports, updateReportStatus } from '../api/reports.js'
import { STATUS } from '../config/venezuela.js'

const reports = ref([])
const filtroActivo = ref('todos')
const errorCarga = ref('')
const mensajeOk = ref('')
const actualizando = ref(null)

const filtros = [
  { value: 'todos', label: 'Todos' },
  { value: STATUS.NEEDING, label: 'Necesitando' },
  { value: STATUS.IN_PROGRESS, label: 'En proceso' },
  { value: STATUS.DELIVERED, label: 'Entregado' }
]

function normalizeStatus(status) {
  if (status === 'Necesita') return STATUS.NEEDING
  return status || STATUS.NEEDING
}

function statusLabel(status) {
  return normalizeStatus(status)
}

function badgeClass(status) {
  const s = normalizeStatus(status)
  return {
    [STATUS.NEEDING]: 'badge-red',
    [STATUS.IN_PROGRESS]: 'badge-yellow',
    [STATUS.DELIVERED]: 'badge-green'
  }[s]
}

function infoClass(status) {
  const s = normalizeStatus(status)
  return {
    [STATUS.NEEDING]: 'status-info--red',
    [STATUS.IN_PROGRESS]: 'status-info--yellow',
    [STATUS.DELIVERED]: 'status-info--green'
  }[s]
}

function conteoPorFiltro(filtro) {
  if (filtro === 'todos') return reports.value.length
  return reports.value.filter((r) => normalizeStatus(r.status) === filtro).length
}

const reportesFiltrados = computed(() => {
  const lista = [...reports.value].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )
  if (filtroActivo.value === 'todos') return lista
  return lista.filter((r) => normalizeStatus(r.status) === filtroActivo.value)
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function loadReports() {
  try {
    reports.value = await fetchReports()
    errorCarga.value = ''
  } catch {
    errorCarga.value = 'No se pudieron cargar los reportes. Verifica que el backend esté corriendo.'
  }
}

async function cambiarEstado(id, status, mensaje) {
  actualizando.value = id
  mensajeOk.value = ''
  try {
    await updateReportStatus(id, status)
    await loadReports()
    mensajeOk.value = mensaje
  } catch {
    errorCarga.value = 'No se pudo actualizar el estado.'
  } finally {
    actualizando.value = null
  }
}

function marcarEnProceso(id) {
  cambiarEstado(id, STATUS.IN_PROGRESS, 'Reporte marcado como en proceso de entrega.')
}

function marcarEntregado(id) {
  cambiarEstado(id, STATUS.DELIVERED, 'Reporte marcado como entregado. ¡Gracias por ayudar!')
}

let intervalId = null

onMounted(async () => {
  await loadReports()
  intervalId = setInterval(loadReports, 10000)
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}
.filter-btn:hover { background: #f1f5f9; }
.filter-btn.active {
  background: #00247d;
  color: #fff;
  border-color: #00247d;
}
.filter-count {
  background: rgba(0, 0, 0, 0.12);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.8rem;
}
.filter-btn.active .filter-count {
  background: rgba(255, 255, 255, 0.25);
}
.reportes-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.report-card { padding: 18px; }
.report-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}
.report-top h3 { margin: 0 0 4px; font-size: 1.1rem; }
.report-meta { margin: 0; color: #334155; }
.report-zone { margin: 0 0 6px; color: #64748b; font-size: 0.9rem; }
.report-desc { margin: 0 0 6px; color: #475569; font-size: 0.9rem; }
.report-date { margin: 0 0 12px; font-size: 0.8rem; color: #94a3b8; }
.status-info {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.875rem;
  margin-bottom: 12px;
}
.status-info--red { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.status-info--yellow { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
.status-info--green { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
.report-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.state-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 700;
  font-size: 0.78rem;
}

@media (max-width: 600px) {
  .report-top { flex-direction: column; }
  .report-actions .btn { width: 100%; }
  .filters { justify-content: center; }
}
</style>
