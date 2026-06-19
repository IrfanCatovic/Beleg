import type { AxiosInstance } from 'axios'
import type { FerrataRow } from '../types/ferrata'
import type { PeakRow } from '../types/peak'

export async function fetchPublicFerratas(client: AxiosInstance): Promise<FerrataRow[]> {
  const res = await client.get<{ ferratas?: FerrataRow[] } | FerrataRow[]>('/api/ferratas')
  if (Array.isArray(res.data)) return res.data
  return res.data.ferratas ?? []
}

export async function fetchFerrataBySlug(client: AxiosInstance, slug: string): Promise<FerrataRow> {
  const res = await client.get<FerrataRow>(`/api/ferratas/slug/${encodeURIComponent(slug)}`)
  return res.data
}

export async function fetchPeaks(client: AxiosInstance): Promise<PeakRow[]> {
  const res = await client.get<{ peaks?: PeakRow[] } | PeakRow[]>('/api/peaks')
  if (Array.isArray(res.data)) return res.data
  return res.data.peaks ?? []
}

export async function listGuidesCatalog(
  client: AxiosInstance,
  params?: { category?: string; limit?: number },
): Promise<unknown[]> {
  const res = await client.get<{ guides?: unknown[] }>('/api/guides', { params })
  return res.data.guides ?? []
}
