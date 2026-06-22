import type { AxiosInstance } from 'axios'
import type { FerrataRow } from '../types/ferrata'
import type { HotelNearbyPublic, HotelRow } from '../types/hotel'
import type { PeakRow } from '../types/peak'

export interface FetchFerratasParams {
  search?: string
  tezina?: string
}

export interface FetchFerratasResult {
  ferrate: FerrataRow[]
  total: number
}

export async function fetchPublicFerratas(
  client: AxiosInstance,
  params?: FetchFerratasParams,
): Promise<FerrataRow[]> {
  const result = await fetchPublicFerratasPaged(client, params)
  return result.ferrate
}

export async function fetchPublicFerratasPaged(
  client: AxiosInstance,
  params?: FetchFerratasParams,
): Promise<FetchFerratasResult> {
  const res = await client.get<{ ferrate?: FerrataRow[]; ferratas?: FerrataRow[]; total?: number }>(
    '/api/ferratas',
    {
      params: {
        search: params?.search?.trim() || undefined,
        tezina: params?.tezina?.trim() || undefined,
      },
    },
  )
  const ferrate = res.data.ferrate ?? res.data.ferratas ?? []
  return { ferrate, total: res.data.total ?? ferrate.length }
}

export async function fetchPublicFerratasCatalog(client: AxiosInstance): Promise<FerrataRow[]> {
  return fetchPublicFerratas(client)
}

export async function fetchFerrataBySlug(client: AxiosInstance, slug: string): Promise<FerrataRow> {
  const res = await client.get<{ ferrata?: FerrataRow } | FerrataRow>(
    `/api/ferratas/slug/${encodeURIComponent(slug)}`,
  )
  const data = res.data
  if (data && typeof data === 'object' && 'ferrata' in data) {
    const wrapped = data as { ferrata?: FerrataRow }
    if (wrapped.ferrata) return wrapped.ferrata
  }
  return data as FerrataRow
}

export interface FerrataUpcomingAction {
  id: number
  naziv: string
  startAt?: string
  datum?: string
  klubNaziv?: string
  maxLjudi?: number
  prijavljeno?: number
}

export async function fetchFerrataUpcomingActions(
  client: AxiosInstance,
  ferrataId: number,
): Promise<FerrataUpcomingAction[]> {
  const res = await client.get<{ akcije?: FerrataUpcomingAction[] }>(
    `/api/ferratas/${ferrataId}/upcoming-actions`,
  )
  return res.data.akcije ?? []
}

export async function fetchHotelsNearby(
  client: AxiosInstance,
  params: { lat: number; lng: number; radiusKm?: number; limit?: number },
): Promise<HotelNearbyPublic[]> {
  const res = await client.get<{ hotels?: HotelNearbyPublic[] }>('/api/hotels/nearby', {
    params: {
      lat: params.lat,
      lng: params.lng,
      radius_km: params.radiusKm ?? 50,
      limit: params.limit ?? 20,
    },
  })
  return res.data.hotels ?? []
}

export interface GuideNearbyPublic {
  id: number
  naslov?: string
  opis?: string
  grad?: string
  region?: string
  drzava?: string
  baseLat?: number
  baseLng?: number
  distanceKm?: number
  prosecnaOcena?: number
  brojOcena?: number
  user?: {
    id: number
    username: string
    fullName?: string
    avatarUrl?: string
    telefon?: string
  }
}

export async function listGuidesNearby(
  client: AxiosInstance,
  params: {
    lat: number
    lng: number
    radiusKm?: number
    limit?: number
    tourType?: string
  },
): Promise<GuideNearbyPublic[]> {
  const res = await client.get<{ guides?: GuideNearbyPublic[] }>('/api/guides/nearby', {
    params: {
      lat: params.lat,
      lng: params.lng,
      radius_km: params.radiusKm ?? 100,
      limit: params.limit ?? 30,
      ...(params.tourType ? { tour_type: params.tourType } : {}),
    },
  })
  return res.data.guides ?? []
}

export async function fetchPeakById(client: AxiosInstance, peakId: number | string): Promise<PeakRow> {
  const res = await client.get<PeakRow>(`/api/peaks/${peakId}`)
  return res.data
}

export async function fetchPeaks(client: AxiosInstance): Promise<PeakRow[]> {
  const res = await client.get<{ peaks?: PeakRow[] } | PeakRow[]>('/api/peaks')
  if (Array.isArray(res.data)) return res.data
  return res.data.peaks ?? []
}

export async function fetchHotels(client: AxiosInstance): Promise<HotelRow[]> {
  const res = await client.get<{ hotels?: HotelRow[] } | HotelRow[]>('/api/hotels')
  if (Array.isArray(res.data)) return res.data
  return res.data.hotels ?? []
}

export interface ExploreMapData {
  ferratas: { ferrate?: FerrataRow[] }
  hotels: { hotels?: HotelRow[] }
  peaks: { peaks?: PeakRow[] }
}

export async function fetchExploreMapData(client: AxiosInstance): Promise<ExploreMapData> {
  const [ferratasRes, hotelsRes, peaksRes] = await Promise.all([
    client.get<{ ferrate?: FerrataRow[] }>('/api/ferratas'),
    client.get<{ hotels?: HotelRow[] }>('/api/hotels'),
    client.get<{ peaks?: PeakRow[] }>('/api/peaks'),
  ])
  return {
    ferratas: ferratasRes.data,
    hotels: hotelsRes.data,
    peaks: peaksRes.data,
  }
}

export async function listGuidesCatalog(
  client: AxiosInstance,
  params?: { category?: string; limit?: number },
): Promise<GuideNearbyPublic[]> {
  const res = await client.get<{ guides?: GuideNearbyPublic[] }>('/api/guides', {
    params: {
      category: params?.category ?? 'all',
      limit: params?.limit ?? 100,
    },
  })
  return res.data.guides ?? []
}
