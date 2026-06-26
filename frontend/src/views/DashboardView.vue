<template>
  <div class="dashboard">
    <header class="dashboard-head">
      <h2>Dashboard de donativos</h2>
      <p>Estados y zonas que más necesitan ayuda en Venezuela.</p>
    </header>

    <p v-if="errorCarga" class="error-msg" role="alert">{{ errorCarga }}</p>

    <section class="kpi-grid">
      <div class="kpi-card kpi-card--red">
        <span class="kpi-label">Necesitando</span>
        <strong class="kpi-value">{{ stats.byStatus?.Necesitando ?? 0 }}</strong>
      </div>
      <div class="kpi-card kpi-card--yellow">
        <span class="kpi-label">En proceso</span>
        <strong class="kpi-value">{{ stats.byStatus?.['En proceso'] ?? 0 }}</strong>
      </div>
      <div class="kpi-card kpi-card--green">
        <span class="kpi-label">Entregados</span>
        <strong class="kpi-value">{{ stats.byStatus?.Entregado ?? 0 }}</strong>
      </div>
      <div class="kpi-card kpi-card--blue">
        <span class="kpi-label">Total reportes</span>
        <strong class="kpi-value">{{ stats.total ?? 0 }}</strong>
      </div>
    </section>

    <section class="charts-section">
      <div class="dash-card chart-panel">
        <h3 class="chart-title">Estado y municipio que más necesitan</h3>
        <div class="chart-box">
          <Bar v-if="needingChartData" :data="needingChartData" :options="barOptions" />
          <p v-else class="chart-empty">No hay reportes en estado «Necesitando».</p>
        </div>
      </div>

      <div class="dash-card chart-panel">
        <h3 class="chart-title">Estado de los reportes</h3>
        <div class="chart-box chart-box--donut">
          <Doughnut v-if="statusChartData" :data="statusChartData" :options="doughnutOptions" />
          <p v-else class="chart-empty">Sin datos aún.</p>
        </div>
      </div>

      <div class="dash-card chart-panel chart-panel--wide">
        <h3 class="chart-title">Distribución por estado y municipio</h3>
        <div class="chart-box">
          <Bar v-if="allStatesChartData" :data="allStatesChartData" :options="barOptionsBlue" />
          <p v-else class="chart-empty">Sin datos aún.</p>
        </div>
      </div>
    </section>

    <section class="dash-card table-panel">
      <h3 class="chart-title">Reportes en estado «Necesitando»</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Insumo</th>
              <th>Cantidad</th>
              <th>Estado</th>
              <th>Municipio</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="report in stats.needingReports" :key="report.id">
              <td>{{ report.title }}</td>
              <td>{{ report.item }}</td>
              <td>{{ report.quantity || '—' }}</td>
              <td><span class="state-tag">{{ report.state || 'Sin estado' }}</span></td>
              <td>{{ report.municipality || '—' }}</td>
              <td>{{ formatDate(report.createdAt) }}</td>
            </tr>
            <tr v-if="!stats.needingReports?.length">
              <td colspan="6" class="empty-cell">No hay reportes pendientes.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar, Doughnut } from 'vue-chartjs'
import { fetchStats } from '../api/reports.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, ArcElement, Tooltip, Legend)

const stats = ref({
  total: 0,
  byStatus: {},
  byState: [],
  needingByState: [],
  needingReports: []
})
const errorCarga = ref('')

const barOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#0f172a' }
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: { stepSize: 1, precision: 0 },
      grid: { color: '#f1f5f9' }
    },
    y: {
      grid: { display: false },
      ticks: { font: { size: 11 }, autoSkip: false }
    }
  }
}

const barOptionsBlue = {
  ...barOptions,
  plugins: {
    ...barOptions.plugins,
    tooltip: { backgroundColor: '#1e3a8a' }
  }
}

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } }
  }
}

const needingChartData = computed(() => {
  const items = (stats.value.needingByState || []).slice(0, 8)
  if (!items.length) return null
  return {
    labels: items.map((i) => i.name),
    datasets: [{
      data: items.map((i) => i.count),
      backgroundColor: '#dc2626',
      borderRadius: 6,
      barThickness: 18
    }]
  }
})

const allStatesChartData = computed(() => {
  const items = (stats.value.byState || []).slice(0, 8)
  if (!items.length) return null
  return {
    labels: items.map((i) => i.name),
    datasets: [{
      data: items.map((i) => i.count),
      backgroundColor: '#2563eb',
      borderRadius: 6,
      barThickness: 18
    }]
  }
})

const statusChartData = computed(() => {
  const s = stats.value.byStatus || {}
  const total = (s.Necesitando || 0) + (s['En proceso'] || 0) + (s.Entregado || 0)
  if (!total) return null
  return {
    labels: ['Necesitando', 'En proceso', 'Entregado'],
    datasets: [{
      data: [s.Necesitando || 0, s['En proceso'] || 0, s.Entregado || 0],
      backgroundColor: ['#dc2626', '#f59e0b', '#10b981'],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }
})

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

async function loadStats() {
  try {
    stats.value = await fetchStats()
    errorCarga.value = ''
  } catch {
    errorCarga.value = 'No se pudieron cargar las estadísticas. Verifica el backend.'
  }
}

let intervalId = null

onMounted(async () => {
  await loadStats()
  intervalId = setInterval(loadStats, 15000)
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 18px; }
.dashboard-head h2 { margin: 0 0 4px; font-size: 1.5rem; }
.dashboard-head p { margin: 0; color: #64748b; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.kpi-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}
.kpi-label { font-size: 0.85rem; color: #64748b; font-weight: 600; }
.kpi-value { font-size: 2rem; line-height: 1; }
.kpi-card--red .kpi-value { color: #dc2626; }
.kpi-card--yellow .kpi-value { color: #d97706; }
.kpi-card--green .kpi-value { color: #059669; }
.kpi-card--blue .kpi-value { color: #2563eb; }

.charts-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.dash-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}
.chart-panel--wide { grid-column: 1 / -1; }
.chart-title {
  margin: 0 0 14px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
}
.chart-box {
  height: 260px;
  position: relative;
}
.chart-box--donut { height: 280px; }
.chart-empty {
  color: #64748b;
  text-align: center;
  padding: 40px 16px;
  margin: 0;
}

.table-panel { padding: 18px; }
.table-wrap { overflow-x: auto; }
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}
.data-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}
.state-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 700;
  font-size: 0.8rem;
  white-space: nowrap;
}
.place-cell {
  max-width: 220px;
  color: #64748b;
  font-size: 0.82rem;
}
.empty-cell { text-align: center; color: #64748b; padding: 20px; }

@media (max-width: 900px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-section { grid-template-columns: 1fr; }
  .chart-panel--wide { grid-column: auto; }
}
@media (max-width: 480px) {
  .kpi-grid { grid-template-columns: 1fr 1fr; }
}
</style>
