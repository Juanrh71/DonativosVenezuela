import { createRouter, createWebHistory } from 'vue-router'
import RegistrarView from '../views/RegistrarView.vue'
import ReportesView from '../views/ReportesView.vue'
import MapaVivoView from '../views/MapaVivoView.vue'
import DashboardView from '../views/DashboardView.vue'

const routes = [
  { path: '/', redirect: '/registrar' },
  { path: '/registrar', name: 'registrar', component: RegistrarView },
  { path: '/reportes', name: 'reportes', component: ReportesView },
  { path: '/mapa', name: 'mapa', component: MapaVivoView },
  { path: '/dashboard', name: 'dashboard', component: DashboardView }
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})
