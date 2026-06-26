import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { searchPlace, reverseGeocodeDetails, getReportState, getReportMunicipality, getDashboardZone } from './geocoding.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, 'data', 'reports.json')
const PORT = process.env.PORT || 3001

const app = express()
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'https://juanrh71.github.io'
  ]
}))
app.use(express.json())

const SAMPLE_REPORTS = []

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function loadReports() {
  ensureDataDir()
  if (!fs.existsSync(DATA_FILE)) {
    saveReports(SAMPLE_REPORTS)
    return [...SAMPLE_REPORTS]
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [...SAMPLE_REPORTS]
  } catch {
    saveReports(SAMPLE_REPORTS)
    return [...SAMPLE_REPORTS]
  }
}

function saveReports(reports) {
  ensureDataDir()
  fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2), 'utf-8')
}

let reports = loadReports()

function normalizeStatus(status) {
  const map = {
    Necesita: 'Necesitando',
    'En proceso de entrega': 'En proceso',
    Entregado: 'Entregado'
  }
  return map[status] || status || 'Necesitando'
}

function computeStats(list) {
  const byStatus = { Necesitando: 0, 'En proceso': 0, Entregado: 0 }
  const byState = {}
  const needingByState = {}

  for (const report of list) {
    const status = normalizeStatus(report.status)
    if (byStatus[status] != null) byStatus[status] += 1

    const zone = getDashboardZone(report)
    byState[zone] = (byState[zone] || 0) + 1
    if (status === 'Necesitando') {
      needingByState[zone] = (needingByState[zone] || 0) + 1
    }
  }

  const sortDesc = (obj) =>
    Object.entries(obj)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

  return {
    total: list.length,
    byStatus,
    byState: sortDesc(byState),
    needingByState: sortDesc(needingByState),
    needingReports: list
      .filter((r) => normalizeStatus(r.status) === 'Necesitando')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((r) => ({
        ...r,
        state: getReportState(r),
        municipality: getReportMunicipality(r),
        dashboardZone: getDashboardZone(r)
      }))
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, reports: reports.length })
})

app.get('/api/geocoding', async (req, res) => {
  const q = req.query.q
  if (!q || !String(q).trim()) {
    return res.status(400).json({ ok: false, error: 'Falta el parámetro q.' })
  }
  try {
    const result = await searchPlace(String(q))
    res.json({ ok: true, result })
  } catch {
    res.status(502).json({ ok: false, error: 'No se pudo buscar el lugar.' })
  }
})

app.get('/api/geocoding/reverse', async (req, res) => {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ ok: false, error: 'Coordenadas inválidas.' })
  }
  try {
    const result = await reverseGeocodeDetails(lat, lng)
    res.json({ ok: true, result })
  } catch {
    res.status(502).json({ ok: false, error: 'No se pudo obtener la dirección.' })
  }
})

app.get('/api/reports', (_req, res) => {
  res.json(
    reports.map((r) => ({
      ...r,
      state: getReportState(r),
      municipality: getReportMunicipality(r)
    }))
  )
})

app.get('/api/stats', (_req, res) => {
  res.json(computeStats(reports))
})

app.post('/api/reports', (req, res) => {
  const report = {
    id: Date.now(),
    title: req.body.title || '',
    item: req.body.item || '',
    quantity: req.body.quantity || '',
    state: req.body.state || getReportState(req.body),
    municipality: req.body.municipality || getReportMunicipality(req.body),
    locationName: req.body.locationName || '',
    latitude: req.body.latitude != null && req.body.latitude !== '' ? Number(req.body.latitude) : null,
    longitude: req.body.longitude != null && req.body.longitude !== '' ? Number(req.body.longitude) : null,
    description: req.body.description || '',
    status: normalizeStatus(req.body.status),
    createdAt: new Date().toISOString()
  }
  reports.unshift(report)
  saveReports(reports)
  res.status(201).json(report)
})

app.put('/api/reports/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = reports.find((r) => r.id === id)
  if (!existing) {
    return res.status(404).json({ error: 'Reporte no encontrado' })
  }
  reports = reports.map((report) =>
    report.id === id
      ? { ...report, status: normalizeStatus(req.body.status) }
      : report
  )
  saveReports(reports)
  const updated = reports.find((r) => r.id === id)
  res.json(updated)
})

// En producción (Render): servir el frontend compilado desde la misma URL
const FRONTEND_DIST = path.join(__dirname, '../frontend/dist')
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
  })
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor en http://0.0.0.0:${PORT}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Puerto ${PORT} en uso. Cierra el proceso anterior o usa PORT=3002 npm start`)
    process.exit(1)
  }
  throw err
})
