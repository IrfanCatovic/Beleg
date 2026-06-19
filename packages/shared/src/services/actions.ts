import type { AxiosInstance } from 'axios'
import type { AkcijaDetail, AkcijaListItem } from '../types/akcija'
import type { Prijava } from '../types/prijava'

export interface AkcijeListResponse {
  aktivne?: AkcijaListItem[]
  zavrsene?: AkcijaListItem[]
  vodeneAktivne?: AkcijaListItem[]
  vodeneZavrsene?: AkcijaListItem[]
  mojePrivatneAktivne?: AkcijaListItem[]
  mojePrivatneZavrsene?: AkcijaListItem[]
}

export interface MojePrijaveResponse {
  prijavljeneAkcije?: number[]
  otkaziveAkcije?: number[]
}

export interface MojaPrijavaPayload {
  status: string
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: Array<{ rentId: number; kolicina: number }>
}

export interface MojaPrijavaResponse {
  prijava: MojaPrijavaPayload | null
}

export async function fetchAkcije(
  client: AxiosInstance,
  options?: { scope?: string },
): Promise<AkcijeListResponse> {
  const res = await client.get<AkcijeListResponse>('/api/akcije', {
    params: options?.scope ? { scope: options.scope } : undefined,
  })
  return res.data
}

export async function fetchMojePrijave(client: AxiosInstance): Promise<MojePrijaveResponse> {
  const res = await client.get<MojePrijaveResponse>('/api/moje-prijave')
  return res.data
}

export async function fetchAkcijaById(
  client: AxiosInstance,
  id: number | string,
  inviteToken?: string,
): Promise<AkcijaDetail> {
  const res = await client.get<AkcijaDetail>(`/api/akcije/${id}`, {
    params: inviteToken ? { inviteToken } : undefined,
  })
  return res.data
}

export async function fetchMojaPrijavaZaAkciju(
  client: AxiosInstance,
  id: number | string,
): Promise<MojaPrijavaResponse> {
  const res = await client.get<MojaPrijavaResponse>(`/api/akcije/${id}/moja-prijava`)
  return res.data
}

export async function fetchPrijaveZaAkciju(
  client: AxiosInstance,
  id: number | string,
): Promise<Prijava[]> {
  const res = await client.get<{ prijave?: Prijava[] }>(`/api/akcije/${id}/prijave`)
  return res.data.prijave ?? []
}

export async function prijaviNaAkciju(
  client: AxiosInstance,
  id: number | string,
  payload?: Record<string, unknown>,
): Promise<unknown> {
  const res = await client.post(`/api/akcije/${id}/prijavi`, payload ?? {})
  return res.data
}

export async function updateMojaPrijava(
  client: AxiosInstance,
  id: number | string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await client.patch(`/api/akcije/${id}/moja-prijava`, payload)
  return res.data
}

export async function otkaziPrijavu(client: AxiosInstance, id: number | string): Promise<void> {
  await client.delete(`/api/akcije/${id}/prijavi`)
}

export async function fetchMojePopeoSe(client: AxiosInstance): Promise<unknown> {
  const res = await client.get('/api/moje-popeo-se')
  return res.data
}

export async function createAkcija(
  client: AxiosInstance,
  formData: FormData,
): Promise<{ akcija?: { id: number } }> {
  const res = await client.post<{ akcija?: { id: number } }>('/api/akcije', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function updateAkcija(client: AxiosInstance, id: number | string, formData: FormData): Promise<void> {
  await client.patch(`/api/akcije/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function geocodeQuery(
  client: AxiosInstance,
  q: string,
): Promise<{ lat: number; lng: number }> {
  const res = await client.get<{ lat: number; lng: number }>('/api/geocode', { params: { q } })
  return res.data
}

export interface ExternalUserCandidate {
  id: number
  username: string
  fullName?: string
  avatarUrl?: string
  klubId?: number | null
  klubNaziv?: string
}

export async function fetchEligibleClubMembers(
  client: AxiosInstance,
  akcijaId: number,
  params: { q?: string; offset?: number; limit?: number },
): Promise<ExternalUserCandidate[]> {
  const res = await client.get<{ users: ExternalUserCandidate[] }>(
    `/api/akcije/${akcijaId}/eligible-club-members`,
    { params },
  )
  return res.data.users ?? []
}

export async function fetchEligibleExternalUsers(
  client: AxiosInstance,
  akcijaId: number | string,
  params: { scope: string; q?: string; offset?: number; limit?: number },
): Promise<ExternalUserCandidate[]> {
  const res = await client.get<{ users: ExternalUserCandidate[] }>(
    `/api/akcije/${akcijaId}/eligible-external-users`,
    { params },
  )
  return res.data.users ?? []
}

export async function addClubMembersCompleted(
  client: AxiosInstance,
  akcijaId: number,
  payload: { korisnikIds: number[] },
): Promise<unknown> {
  const res = await client.post(`/api/akcije/${akcijaId}/add-club-members-completed`, payload)
  return res.data
}

export async function createParticipationRequest(
  client: AxiosInstance,
  akcijaId: number | string,
  targetUserId: number,
): Promise<unknown> {
  const res = await client.post(`/api/akcije/${akcijaId}/participation-requests`, { targetUserId })
  return res.data
}
