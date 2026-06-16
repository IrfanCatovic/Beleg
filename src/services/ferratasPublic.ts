import api from './api'

export interface PublicFerrataRow {
  id: number
  naziv: string
  tezina: string
  drzava?: string
  gradOpstina?: string
  lokacija?: string
  duzinaM?: number
  visinskaRazlikaM?: number
  trajanjeMin?: number
  trajanjeMax?: number
  coverImage?: string
}

export async function fetchPublicFerratas(params: URLSearchParams) {
  const res = await api.get<{ ferrate?: PublicFerrataRow[]; total?: number }>(
    `/api/ferratas?${params.toString()}`,
  )
  return {
    ferrate: res.data.ferrate ?? [],
    total: res.data.total ?? 0,
  }
}

export async function fetchPublicFerrataById(id: number) {
  const res = await api.get<{ ferrata?: PublicFerrataRow }>(`/api/ferratas/${id}`)
  return res.data.ferrata
}

export async function fetchPublicFerratasCatalog() {
  const res = await api.get<{ ferrate?: PublicFerrataRow[] }>('/api/ferratas')
  return res.data.ferrate ?? []
}
