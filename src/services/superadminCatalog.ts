import api from './api'

export async function fetchSuperadminFerratas() {
  const res = await api.get('/api/superadmin/ferratas')
  return res.data
}

export async function fetchSuperadminFerrataById(id: number) {
  const res = await api.get(`/api/superadmin/ferratas/${id}`)
  return res.data
}

export async function createSuperadminFerrata(payload: Record<string, unknown>) {
  const res = await api.post('/api/superadmin/ferratas', payload)
  return res.data
}

export async function updateSuperadminFerrata(id: number, payload: Record<string, unknown>) {
  await api.put(`/api/superadmin/ferratas/${id}`, payload)
}

export async function updateSuperadminFerrataGalerija(id: number, galerija: string[]) {
  await api.patch(`/api/superadmin/ferratas/${id}/galerija`, { galerija })
}

export async function fetchSuperadminPeaks() {
  const res = await api.get('/api/superadmin/peaks')
  return res.data
}

export async function createSuperadminPeak(payload: Record<string, unknown>) {
  await api.post('/api/superadmin/peaks', payload)
}

export async function updateSuperadminPeak(id: number, payload: Record<string, unknown>) {
  await api.put(`/api/superadmin/peaks/${id}`, payload)
}

export async function deleteSuperadminPeak(id: number) {
  await api.delete(`/api/superadmin/peaks/${id}`)
}

export async function fetchSuperadminHotels() {
  const res = await api.get('/api/superadmin/hotels')
  return res.data
}

export async function createSuperadminHotel(payload: Record<string, unknown>) {
  await api.post('/api/superadmin/hotels', payload)
}

export async function updateSuperadminHotel(id: number, payload: Record<string, unknown>) {
  await api.put(`/api/superadmin/hotels/${id}`, payload)
}

export async function deleteSuperadminHotel(id: number) {
  await api.delete(`/api/superadmin/hotels/${id}`)
}
