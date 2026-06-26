import { ESTADOS_VENEZUELA } from './config/venezuela.js'

const USER_AGENT = 'DonativosVenezuela/1.0 (ayuda terremoto)'

const STATE_ALIASES = {
  'Distrito Metropolitano de Caracas': 'Distrito Capital',
  'Federal District': 'Distrito Capital',
  'Caracas': 'Distrito Capital',
  'La Guaira': 'La Guaira',
  'Vargas': 'La Guaira'
}

export function normalizeStateName(raw) {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  return STATE_ALIASES[trimmed] || trimmed
}

export function extractStateFromAddress(address) {
  if (!address) return ''
  const candidate =
    address.state ||
    address.region ||
    address.state_district ||
    address.county ||
    ''
  return normalizeStateName(candidate)
}

export function extractPlaceFromAddress(address) {
  if (!address) return ''
  const parts = [
    address.amenity,
    address.road,
    address.neighbourhood,
    address.suburb,
    address.quarter,
    address.city_district,
    address.city,
    address.town,
    address.village
  ].filter(Boolean)
  const unique = [...new Set(parts)]
  return unique.slice(0, 2).join(', ') || address.city || address.town || ''
}

export function extractMunicipalityFromAddress(address) {
  if (!address) return ''
  const raw =
    address.municipality ||
    address.county ||
    address.city_district ||
    address.city ||
    address.town ||
    address.village ||
    address.suburb ||
    ''
  return String(raw)
    .replace(/^Municipio\s+/i, '')
    .replace(/^Parroquia\s+/i, '')
    .trim()
}

export function extractMunicipalityFromText(text) {
  const value = String(text || '')
  const muniMatch = value.match(/Municipio\s+([^,]+)/i)
  if (muniMatch) return muniMatch[1].trim()
  const parroMatch = value.match(/Parroquia\s+([^,]+)/i)
  if (parroMatch) return parroMatch[1].trim()
  return ''
}

export function extractStateFromText(text) {
  const value = String(text || '')
  for (const estado of ESTADOS_VENEZUELA) {
    if (value.includes(estado)) return estado
  }
  if (/distrito capital|caracas/i.test(value)) return 'Distrito Capital'
  return ''
}

export function getReportState(report) {
  const raw = String(report.state || '').trim()
  if (raw && raw.length <= 40 && ESTADOS_VENEZUELA.includes(raw)) return raw
  if (raw && raw.length <= 40) {
    const fromRaw = extractStateFromText(raw)
    if (fromRaw) return fromRaw
  }
  return extractStateFromText(report.locationName) || 'Sin estado'
}

export function getReportMunicipality(report) {
  if (report.municipality) {
    return String(report.municipality).replace(/^Municipio\s+/i, '').trim()
  }
  const fromText = extractMunicipalityFromText(report.locationName)
  if (fromText) return fromText
  const loc = String(report.locationName || '').trim()
  if (loc && loc.length <= 50 && !loc.includes('Municipio')) {
    const first = loc.split(',')[0]?.trim()
    if (first && first.length <= 35) return first
  }
  return 'Sin municipio'
}

/** Etiqueta corta para gráficas del dashboard: Estado, Municipio */
export function getDashboardZone(report) {
  const state = getReportState(report)
  const municipality = getReportMunicipality(report)
  if (state !== 'Sin estado' && municipality !== 'Sin municipio') {
    return `${state}, ${municipality}`
  }
  if (state !== 'Sin estado') return state
  return 'Sin ubicación'
}

export async function searchPlace(query) {
  const q = String(query || '').trim()
  if (!q) return null

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(q + ', Venezuela')}&format=json&limit=5&countrycodes=ve&accept-language=es`

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' }
  })
  if (!res.ok) return null

  const data = await res.json()
  if (!Array.isArray(data) || !data.length) return null

  const hit = data[0]
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  let zoom = 13
  if (hit.type === 'state' || hit.type === 'administrative') zoom = 8
  if (hit.type === 'city' || hit.type === 'town') zoom = 11

  return {
    lat,
    lng,
    zoom,
    label: hit.display_name,
    bounds: hit.boundingbox
      ? [
          [Number(hit.boundingbox[0]), Number(hit.boundingbox[2])],
          [Number(hit.boundingbox[1]), Number(hit.boundingbox[3])]
        ]
      : null
  }
}

export async function reverseGeocodeDetails(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?` +
    `lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=es`

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' }
  })
  if (!res.ok) return null

  const data = await res.json()
  const address = data.address || {}
  const state = extractStateFromAddress(address) || extractStateFromText(data.display_name)
  const municipality = extractMunicipalityFromAddress(address) || extractMunicipalityFromText(data.display_name)
  const place = extractPlaceFromAddress(address)

  return {
    displayName: data.display_name || '',
    state,
    municipality,
    place,
    latitude: lat,
    longitude: lng
  }
}

export function formatCoords(lat, lng) {
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
}
