import api from './api'

export interface HotelNearbyPublic {
  id: number
  naziv: string
  lat?: number
  lng?: number
  distanceKm?: number
  coverImage?: string
  [key: string]: unknown
}

export async function fetchExploreMapData() {
  const [ferratasRes, hotelsRes, peaksRes] = await Promise.all([
    api.get('/api/ferratas'),
    api.get('/api/hotels'),
    api.get('/api/peaks'),
  ])
  return {
    ferratas: ferratasRes.data,
    hotels: hotelsRes.data,
    peaks: peaksRes.data,
  }
}

export async function fetchHotelsNearby(params: Record<string, unknown>) {
  const res = await api.get<{ hotels?: HotelNearbyPublic[] }>('/api/hotels/nearby', { params })
  return res.data.hotels ?? []
}

export async function fetchPeakById(peakId: number | string) {
  const res = await api.get(`/api/peaks/${peakId}`)
  return res.data
}

export async function fetchFerrataBySlug(slug: string) {
  const res = await api.get(`/api/ferratas/slug/${encodeURIComponent(slug)}`)
  return res.data
}

export async function fetchFerrataUpcomingActions(ferrataId: number) {
  const res = await api.get(`/api/ferratas/${ferrataId}/upcoming-actions`)
  return res.data
}
