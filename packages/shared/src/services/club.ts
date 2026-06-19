import type { AxiosInstance } from 'axios'
import type { ClubAdminStats, ClubJoinRequestItem, KlubData } from '../types/klub'

export async function fetchKlub(client: AxiosInstance): Promise<KlubData> {
  const res = await client.get<{ klub: KlubData }>('/api/klub')
  return res.data.klub
}

export async function fetchKlubByNaziv(client: AxiosInstance, naziv: string): Promise<KlubData> {
  const res = await client.get<{ klub: KlubData }>(`/api/klubovi/${encodeURIComponent(naziv)}`)
  return res.data.klub
}

export async function updateKlub(
  client: AxiosInstance,
  payload: Record<string, unknown>,
): Promise<KlubData> {
  const res = await client.patch<{ klub: KlubData }>('/api/klub', payload)
  return res.data.klub
}

export async function fetchKlubAdminStats(client: AxiosInstance): Promise<ClubAdminStats> {
  const res = await client.get<ClubAdminStats>('/api/klub/admin-stats')
  return res.data
}

export async function fetchClubJoinRequests(
  client: AxiosInstance,
  status = 'pending',
): Promise<ClubJoinRequestItem[]> {
  const res = await client.get<{ requests: ClubJoinRequestItem[] }>('/api/club-membership/requests', {
    params: { status },
  })
  return res.data.requests ?? []
}

export async function respondClubJoinRequest(
  client: AxiosInstance,
  requestId: number,
  action: 'accept' | 'reject' | 'block',
): Promise<void> {
  await client.post(`/api/club-membership/requests/${requestId}/${action}`)
}

export async function leaveClub(client: AxiosInstance): Promise<void> {
  await client.post('/api/club-membership/leave')
}

export async function searchKlubovi(
  client: AxiosInstance,
  search?: string,
): Promise<{ klubovi?: KlubData[] }> {
  const res = await client.get('/api/klubovi', { params: search ? { search } : undefined })
  return res.data
}

export async function createJoinRequest(client: AxiosInstance, clubId: number): Promise<void> {
  await client.post('/api/club-membership/requests', { clubId })
}
