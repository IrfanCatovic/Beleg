import type { GeocodeResult, GeocodingProvider } from './types'

type NominatimAddress = {
  country?: string
  state?: string
  region?: string
  county?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
}

type NominatimHit = {
  display_name?: string
  lat?: string
  lon?: string
  address?: NominatimAddress
}

function userAgent(): string {
  return (
    import.meta.env.VITE_GEOCODING_USER_AGENT ||
    'Planiner/1.0 (ferrata admin geocoding; contact: https://github.com)'
  )
}

function pickCity(addr?: NominatimAddress): string | undefined {
  if (!addr) return undefined
  return addr.city || addr.town || addr.village || addr.municipality || undefined
}

function pickRegion(addr?: NominatimAddress): string | undefined {
  if (!addr) return undefined
  return addr.state || addr.region || addr.county || undefined
}

/** OpenStreetMap Nominatim — pogodno za MVP; zameni drugim GeocodingProvider implementacijom po potrebi. */
export const nominatimProvider: GeocodingProvider = {
  async search(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const q = query.trim()
    if (!q) return []
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '5')
    url.searchParams.set('addressdetails', '1')

    const res = await fetch(url.toString(), {
      signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'sr,en',
        'User-Agent': userAgent(),
      },
    })
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`)
    const data = (await res.json()) as NominatimHit[]
    if (!Array.isArray(data)) return []
    const out: GeocodeResult[] = []
    for (const row of data) {
      const lat = Number(row.lat)
      const lng = Number(row.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const addr = row.address
      out.push({
        label: String(row.display_name || `${lat}, ${lng}`),
        lat,
        lng,
        country: addr?.country,
        region: pickRegion(addr),
        city: pickCity(addr),
      })
    }
    return out
  },
}
