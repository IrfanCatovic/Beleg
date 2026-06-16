import api from './api'

export async function fetchFinansijeDashboard(params: URLSearchParams) {
  const res = await api.get(`/api/finansije/dashboard?${params}`)
  return res.data
}

export async function fetchClanarine(godina: number) {
  const res = await api.get(`/api/finansije/clanarine?godina=${godina}`)
  return res.data
}

export async function createTransakcija(payload: Record<string, unknown>) {
  await api.post('/api/finansije', payload)
}

export async function createClanarina(payload: Record<string, unknown>) {
  await api.post('/api/finansije/clanarina', payload)
}

export async function deleteTransakcija(id: number) {
  await api.delete(`/api/finansije/transakcije/${id}`)
}

export async function fetchTransakcijaById<T = unknown>(id: number) {
  const res = await api.get<T>(`/api/finansije/transakcije/${id}`)
  return res.data
}
