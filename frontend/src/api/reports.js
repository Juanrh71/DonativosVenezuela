import api from './client.js'

export async function fetchReports() {
  const { data } = await api.get('/api/reports')
  return data
}

export async function fetchStats() {
  const { data } = await api.get('/api/stats')
  return data
}

export async function createReport(payload) {
  const { data } = await api.post('/api/reports', payload)
  return data
}

export async function updateReportStatus(id, status) {
  const { data } = await api.put(`/api/reports/${id}`, { status })
  return data
}
