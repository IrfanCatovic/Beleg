import api from './api'

export interface KlubInfo {
  id: number
  naziv: string
  logoUrl?: string
  valuta?: string
  [key: string]: unknown
}

export async function fetchKlub() {
  const res = await api.get<KlubInfo>('/api/klub')
  return res.data
}

export async function updateKlub(payload: Record<string, unknown>) {
  const res = await api.patch('/api/klub', payload)
  return res.data
}
