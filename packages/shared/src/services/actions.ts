import type { AxiosInstance } from 'axios'
import type { AkcijaDetail, AkcijaListItem } from '../types/akcija'
import type { ActionSignupRequest, MojaSignupRequestPayload } from '../types/actionSignupRequest'
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
  pendingSignupAkcije?: number[]
}

export interface MojaPrijavaPayload {
  status: string
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: Array<{ rentId: number; kolicina: number }>
}

export interface MojaPrijavaResponse {
  prijava: MojaPrijavaPayload | null
  signupRequest?: MojaSignupRequestPayload | null
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
  options?: { inviteToken?: string },
): Promise<unknown> {
  const res = await client.post(`/api/akcije/${id}/prijavi`, payload ?? {}, {
    params: options?.inviteToken ? { inviteToken: options.inviteToken } : undefined,
  })
  return res.data
}

export async function updateMojaPrijava(
  client: AxiosInstance,
  id: number | string,
  payload: Record<string, unknown>,
  options?: { inviteToken?: string },
): Promise<unknown> {
  const res = await client.patch(`/api/akcije/${id}/moja-prijava`, payload, {
    params: options?.inviteToken ? { inviteToken: options.inviteToken } : undefined,
  })
  return res.data
}

export async function regenerateAkcijaInviteLink(
  client: AxiosInstance,
  akcijaId: number | string,
): Promise<{ inviteUrl?: string; inviteToken?: string }> {
  const res = await client.post<{ inviteUrl?: string; inviteToken?: string }>(
    `/api/akcije/${akcijaId}/invite-link/regenerate`,
  )
  return res.data
}

export async function otkaziPrijavu(client: AxiosInstance, id: number | string): Promise<void> {
  await client.delete(`/api/akcije/${id}/prijavi`)
}

export async function cancelSignupRequest(client: AxiosInstance, akcijaId: number | string): Promise<void> {
  await client.delete(`/api/akcije/${akcijaId}/signup-requests/moj`)
}

export async function fetchActionSignupRequests(
  client: AxiosInstance,
  akcijaId: number | string,
  status = 'pending',
): Promise<ActionSignupRequest[]> {
  const res = await client.get<{ requests?: ActionSignupRequest[] }>(
    `/api/akcije/${akcijaId}/signup-requests`,
    { params: { status } },
  )
  return res.data.requests ?? []
}

export async function fetchActionSignupRequestById(
  client: AxiosInstance,
  akcijaId: number | string,
  requestId: number | string,
): Promise<ActionSignupRequest> {
  const res = await client.get<{ request: ActionSignupRequest }>(
    `/api/akcije/${akcijaId}/signup-requests/${requestId}`,
  )
  return res.data.request
}

export async function respondToActionSignupRequest(
  client: AxiosInstance,
  akcijaId: number | string,
  requestId: number | string,
  action: 'accept' | 'reject',
): Promise<unknown> {
  const res = await client.post(`/api/akcije/${akcijaId}/signup-requests/${requestId}/respond`, { action })
  return res.data
}

export async function fetchMojiSignupRequests(
  client: AxiosInstance,
  status = 'pending',
): Promise<ActionSignupRequest[]> {
  const res = await client.get<{ requests?: ActionSignupRequest[] }>('/api/moji-signup-requests', {
    params: { status },
  })
  return res.data.requests ?? []
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

export interface ActionParticipationRequest {
  id: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
  updatedAt: string
  respondedAt?: string | null
  action: {
    id: number
    naziv: string
    datum: string
    planina?: string
    vrh?: string
    klubId?: number | null
    klubNaziv?: string
    isCompleted?: boolean
  }
  targetUser: ExternalUserCandidate
  requestedBy: ExternalUserCandidate
}

export async function fetchActionParticipationRequests(
  client: AxiosInstance,
  akcijaId: number | string,
): Promise<ActionParticipationRequest[]> {
  const res = await client.get<{ requests: ActionParticipationRequest[] }>(
    `/api/akcije/${akcijaId}/participation-requests`,
  )
  return res.data.requests ?? []
}

export async function createParticipationRequest(
  client: AxiosInstance,
  akcijaId: number | string,
  targetUserId: number,
): Promise<ActionParticipationRequest> {
  const res = await client.post<{ request: ActionParticipationRequest }>(
    `/api/akcije/${akcijaId}/participation-requests`,
    { targetUserId },
  )
  return res.data.request
}

export async function cancelParticipationRequest(
  client: AxiosInstance,
  akcijaId: number | string,
  requestId: number,
): Promise<void> {
  await client.patch(`/api/akcije/${akcijaId}/participation-requests/${requestId}/cancel`)
}

export async function dodajPrevoz(
  client: AxiosInstance,
  akcijaId: number | string,
  data: {
    tipPrevoza: string
    nazivGrupe: string
    kapacitet: number
    cenaPoOsobi: number
    join?: boolean
  },
): Promise<unknown> {
  const res = await client.post(`/api/akcije/${akcijaId}/prevoz`, data)
  return res.data
}

export async function updatePrijavaPlatio(
  client: AxiosInstance,
  prijavaId: number,
  platio: boolean,
): Promise<void> {
  await client.patch(`/api/prijave/${prijavaId}/platio`, { platio })
}

export async function updatePrijavaStatus(
  client: AxiosInstance,
  prijavaId: number,
  status: string,
): Promise<void> {
  await client.post(`/api/prijave/${prijavaId}/status`, { status })
}

export async function deletePrijava(client: AxiosInstance, prijavaId: number): Promise<void> {
  await client.delete(`/api/prijave/${prijavaId}`)
}

export async function deleteAkcija(client: AxiosInstance, id: number | string): Promise<void> {
  await client.delete(`/api/akcije/${id}`)
}

export async function dodajClanaPopeoSe(
  client: AxiosInstance,
  akcijaId: number | string,
  korisnikId: number,
): Promise<unknown> {
  const res = await client.post(`/api/akcije/${akcijaId}/dodaj-clana-popeo-se`, { korisnikId })
  return res.data
}

export interface ZavrsiAkcijaResponse {
  akcija?: AkcijaDetail
  finansijeTip?: 'nista' | 'uplata' | 'isplata'
  netoFinansije?: number
}

export async function zavrsiAkciju(
  client: AxiosInstance,
  akcijaId: number | string,
  rashodNaAkciji: number,
): Promise<ZavrsiAkcijaResponse> {
  const res = await client.post<ZavrsiAkcijaResponse>(`/api/akcije/${akcijaId}/zavrsi`, { rashodNaAkciji })
  return res.data
}
