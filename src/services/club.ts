import api from './api'
import type { KlubData, ClubAdminStats, ClubJoinRequestItem } from '../types/klub'

export type { KlubData, ClubAdminStats, ClubJoinRequestItem }

export interface KlubInfo {
  id: number
  naziv: string
  logoUrl?: string
  valuta?: string
  [key: string]: unknown
}

export async function fetchKlub() {
  const res = await api.get<{ klub: KlubData }>('/api/klub')
  return res.data.klub
}

export async function fetchKlubByNaziv(naziv: string) {
  const res = await api.get<{ klub: KlubData }>(`/api/klubovi/${encodeURIComponent(naziv)}`)
  return res.data.klub
}

export async function updateKlub(payload: Record<string, unknown>) {
  const res = await api.patch<{ klub: KlubData }>('/api/klub', payload)
  return res.data.klub
}

export async function updateKlubLogo(formData: FormData) {
  const res = await api.patch<{ klub: KlubData }>('/api/klub/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.klub
}

export async function fetchKlubAdminStats() {
  const res = await api.get<ClubAdminStats>('/api/klub/admin-stats')
  return res.data
}

export async function fetchClubJoinRequests(status = 'pending') {
  const res = await api.get<{ requests: ClubJoinRequestItem[] }>('/api/club-membership/requests', {
    params: { status },
  })
  return res.data.requests ?? []
}

export async function respondClubJoinRequest(requestId: number, action: 'accept' | 'reject' | 'block') {
  await api.post(`/api/club-membership/requests/${requestId}/${action}`)
}

export async function leaveClub() {
  await api.post('/api/club-membership/leave')
}
