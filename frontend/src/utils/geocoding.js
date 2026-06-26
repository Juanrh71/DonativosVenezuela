import api from '../api/client.js'
import { ESTADOS_VENEZUELA } from '../config/venezuela.js'

const STATE_ALIASES = {
  'Distrito Metropolitano de Caracas': 'Distrito Capital',
  'Federal District': 'Distrito Capital',
  Caracas: 'Distrito Capital',
  Vargas: 'La Guaira'
}

function normalizeState(raw) {
  if (!raw) return ''
  return STATE_ALIASES[String(raw).trim()] || String(raw).trim()
}

function extractStateFromAddress(address) {
  if (!address) return ''
  return normalizeState(
    address.state || address.region || address.state_district || address.county || ''
  )
}

function extractPlaceFromAddress(address) {
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
  return [...new Set(parts)].slice(0, 2).join(', ') || address.city || address.town || ''
}

export function extractStateFromText(text) {
  const value = String(text || '')
  for (const estado of ESTADOS_VENEZUELA) {
    if (value.includes(estado)) return estado
  }
  if (/distrito capital|caracas/i.test(value)) return 'Distrito Capital'
  return ''
}

function extractMunicipalityFromAddress(address) {
  if (!address) return ''
  const raw =
    address.municipality ||
    address.county ||
    address.city_district ||
    address.city ||
    address.town ||
    address.village ||
    ''
  return String(raw)
    .replace(/^Municipio\s+/i, '')
    .replace(/^Parroquia\s+/i, '')
    .trim()
}

function parseNominatimReverse(data) {
  const address = data?.address || {}
  const displayName = data?.display_name || ''
  return {
    displayName,
    state: extractStateFromAddress(address) || extractStateFromText(displayName),
    municipality: extractMunicipalityFromAddress(address),
    place: extractPlaceFromAddress(address) || displayName.split(',').slice(0, 2).join(', ').trim()
  }
}

async function reverseDirect(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?` +
    `lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=es`
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
  if (!res.ok) return null
  const data = await res.json()
  return parseNominatimReverse(data)
}

export async function reverseGeocode(lat, lng) {
  const parsedLat = Number(lat)
  const parsedLng = Number(lng)
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null

  try {
    const { data } = await api.get('/api/geocoding/reverse', {
      params: { lat: parsedLat, lng: parsedLng },
      timeout: 8000
    })
    if (data?.result) return data.result
  } catch {
    /* fallback directo */
  }

  try {
    const direct = await reverseDirect(parsedLat, parsedLng)
    if (direct) return direct
  } catch {
    /* sin red */
  }

  return {
    displayName: formatCoords(parsedLat, parsedLng),
    state: guessStateByCoords(parsedLat, parsedLng),
    municipality: '',
    place: formatCoords(parsedLat, parsedLng)
  }
}

export async function searchPlace(query) {
  try {
    const { data } = await api.get('/api/geocoding', {
      params: { q: query },
      timeout: 8000
    })
    if (data?.result) return data.result
  } catch {
    /* fallback */
  }

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query + ', Venezuela')}&format=json&limit=1&countrycodes=ve&accept-language=es`
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || !data.length) return null
  const hit = data[0]
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    zoom: 12,
    label: hit.display_name,
    bounds: hit.boundingbox
      ? [
          [Number(hit.boundingbox[0]), Number(hit.boundingbox[2])],
          [Number(hit.boundingbox[1]), Number(hit.boundingbox[3])]
        ]
      : null
  }
}

/** Aproximación por coordenadas cuando falla Nominatim */
function guessStateByCoords(lat, lng) {
  if (lat >= 10.2 && lat <= 10.7 && lng >= -67.2 && lng <= -66.5) return 'Distrito Capital'
  if (lat >= 10.0 && lat <= 10.8 && lng >= -67.5 && lng <= -66.0) return 'Miranda'
  if (lat >= 10.5 && lat <= 11.0 && lng >= -72.0 && lng <= -71.0) return 'Zulia'
  if (lat >= 7.5 && lat <= 8.5 && lng >= -72.5 && lng <= -71.5) return 'Táchira'
  if (lat >= 10.0 && lat <= 10.8 && lng >= -64.5 && lng <= -63.5) return 'Sucre'
  if (lat >= 10.0 && lat <= 10.5 && lng >= -68.5 && lng <= -67.5) return 'Carabobo'
  if (lat >= 8.0 && lat <= 9.5 && lng >= -72.0 && lng <= -70.5) return 'Barinas'
  if (lat >= 8.5 && lat <= 9.8 && lng >= -71.5 && lng <= -70.0) return 'Portuguesa'
  if (lat >= 9.0 && lat <= 10.5 && lng >= -70.5 && lng <= -68.5) return 'Guárico'
  if (lat >= 9.5 && lat <= 11.0 && lng >= -70.0 && lng <= -68.0) return 'Cojedes'
  if (lat >= 9.0 && lat <= 10.5 && lng >= -69.5 && lng <= -68.0) return 'Yaracuy'
  if (lat >= 9.5 && lat <= 11.5 && lng >= -70.5 && lng <= -68.5) return 'Lara'
  if (lat >= 8.0 && lat <= 9.5 && lng >= -72.5 && lng <= -70.5) return 'Mérida'
  if (lat >= 7.5 && lat <= 9.0 && lng >= -72.0 && lng <= -70.0) return 'Apure'
  if (lat >= 7.0 && lat <= 8.5 && lng >= -62.5 && lng <= -60.5) return 'Bolívar'
  if (lat >= 3.5 && lat <= 6.0 && lng >= -67.5 && lng <= -64.0) return 'Amazonas'
  if (lat >= 7.5 && lat <= 10.5 && lng >= -66.0 && lng <= -61.0) return 'Delta Amacuro'
  if (lat >= 9.5 && lat <= 11.0 && lng >= -64.5 && lng <= -62.0) return 'Monagas'
  if (lat >= 10.0 && lat <= 11.0 && lng >= -64.5 && lng <= -63.5) return 'Anzoátegui'
  if (lat >= 10.5 && lat <= 11.5 && lng >= -64.5 && lng <= -63.5) return 'Nueva Esparta'
  if (lat >= 10.4 && lat <= 11.0 && lng >= -67.5 && lng <= -66.3) return 'La Guaira'
  if (lat >= 10.5 && lat <= 12.0 && lng >= -71.5 && lng <= -69.5) return 'Falcón'
  if (lat >= 9.0 && lat <= 10.5 && lng >= -64.0 && lng <= -62.0) return 'Trujillo'
  return ''
}

export function formatCoords(lat, lng) {
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
}

export function isSecureForGeolocation() {
  return typeof window !== 'undefined' && window.isSecureContext
}

export function geolocationErrorMessage(error) {
  if (!isSecureForGeolocation()) {
    return 'El GPS requiere HTTPS o localhost. Usa la búsqueda del mapa o marca el punto.'
  }
  if (!error) return 'No se pudo obtener la ubicación.'
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permiso de ubicación denegado. Actívalo o marca el mapa.'
    case error.POSITION_UNAVAILABLE:
      return 'Ubicación no disponible. Marca el punto en el mapa.'
    case error.TIMEOUT:
      return 'Tiempo agotado. Marca el punto en el mapa.'
    default:
      return 'No se pudo obtener la ubicación. Marca el punto en el mapa.'
  }
}
