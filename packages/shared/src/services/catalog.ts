import type { AxiosInstance } from 'axios'
import type { FerrataRow } from '../types/ferrata'
import type { HotelRow } from '../types/hotel'
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
  const res = await client.get<FerrataRow>(`/api/ferratas/slug/${encodeURIComponent(slug)}`)
  return res.data
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
): Promise<Array<{ user?: { id: number; username: string; fullName?: string } }>> {
  const res = await client.get<{ guides?: Array<{ user?: { id: number; username: string; fullName?: string } }> }>(
    '/api/guides',
    { params },
  )
  return res.data.guides ?? []
}
