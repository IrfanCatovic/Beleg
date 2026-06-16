import api from './api'
import type { AkcijaDetail, AkcijaListItem } from '../types/akcija'
import type { Prijava } from '../types/prijava'
import type { KorisnikRef } from '../types/korisnik'

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
  targetUser: KorisnikRef & { avatarUrl?: string; klubId?: number | null; klubNaziv?: string }
  requestedBy: KorisnikRef & { avatarUrl?: string; klubId?: number | null; klubNaziv?: string }
}

export interface ExternalUserCandidate extends KorisnikRef {
  avatarUrl?: string
  klubId?: number | null
  klubNaziv?: string
}

export interface ZavrsiAkcijaResponse {
  akcija?: AkcijaDetail
  finansijeTip?: 'nista' | 'uplata' | 'isplata'
  netoFinansije?: number
}

export async function fetchAkcije(options?: { scope?: string }) {
  const res = await api.get<AkcijeListResponse>('/api/akcije', {
    params: options?.scope ? { scope: options.scope } : undefined,
  })
  return res.data
}

export async function fetchMojePrijave() {
  const res = await api.get<MojePrijaveResponse>('/api/moje-prijave')
  return res.data
}

export async function fetchAkcijaById(id: number | string, inviteToken?: string) {
  const res = await api.get<AkcijaDetail>(`/api/akcije/${id}`, inviteToken ? { params: { inviteToken } } : undefined)
  return res.data
}

export async function fetchPrijaveZaAkciju(id: number | string) {
  const res = await api.get<{ prijave?: Prijava[] }>(`/api/akcije/${id}/prijave`)
  return res.data.prijave ?? []
}

export async function fetchMojaPrijavaZaAkciju(id: number | string) {
  const res = await api.get<MojaPrijavaResponse>(`/api/akcije/${id}/moja-prijava`)
  return res.data
}

export async function prijaviNaAkciju(
  id: number | string,
  payload?: Record<string, unknown>,
  config?: { params?: Record<string, string> },
) {
  const res = await api.post(`/api/akcije/${id}/prijavi`, payload ?? {}, config)
  return res.data
}

export async function updateMojaPrijava(
  id: number | string,
  payload: Record<string, unknown>,
  config?: { params?: Record<string, string> },
) {
  const res = await api.patch(`/api/akcije/${id}/moja-prijava`, payload, config)
  return res.data
}

export async function otkaziPrijavu(id: number | string) {
  await api.delete(`/api/akcije/${id}/prijavi`)
}

export async function deleteAkcija(id: number | string) {
  await api.delete(`/api/akcije/${id}`)
}

export async function dodajPrevoz(id: number | string, data: Record<string, unknown>) {
  await api.post(`/api/akcije/${id}/prevoz`, data)
}

export async function obrisiPrevoz(akcijaId: number | string, prevozId: number) {
  await api.delete(`/api/akcije/${akcijaId}/prevoz/${prevozId}`)
}

export async function updatePrijavaStatus(prijavaId: number, status: string) {
  await api.post(`/api/prijave/${prijavaId}/status`, { status })
}

export async function updatePrijavaPlatio(prijavaId: number, platio: boolean) {
  await api.patch(`/api/prijave/${prijavaId}/platio`, { platio })
}

export async function markPrijavePlatio(prijavaIds: number[]) {
  return Promise.allSettled(prijavaIds.map((pid) => updatePrijavaPlatio(pid, true)))
}

export async function deletePrijava(prijavaId: number) {
  await api.delete(`/api/prijave/${prijavaId}`)
}

export async function dodajClanaPopeoSe(akcijaId: number | string, korisnikId: number) {
  await api.post(`/api/akcije/${akcijaId}/dodaj-clana-popeo-se`, { korisnikId })
}

export async function cancelParticipationRequest(akcijaId: number | string, requestId: number) {
  await api.patch(`/api/akcije/${akcijaId}/participation-requests/${requestId}/cancel`)
}

export async function fetchParticipationRequests(akcijaId: number | string) {
  const res = await api.get<{ requests: ActionParticipationRequest[] }>(`/api/akcije/${akcijaId}/participation-requests`)
  return res.data.requests ?? []
}

export async function createParticipationRequest(akcijaId: number | string, targetUserId: number) {
  const res = await api.post<{ request: ActionParticipationRequest }>(`/api/akcije/${akcijaId}/participation-requests`, {
    targetUserId,
  })
  return res.data.request
}

export async function fetchEligibleExternalUsers(
  akcijaId: number | string,
  params: { scope: string; q?: string; offset?: number; limit?: number },
) {
  const res = await api.get<{ users: ExternalUserCandidate[] }>(`/api/akcije/${akcijaId}/eligible-external-users`, {
    params,
  })
  return res.data.users ?? []
}

export async function zavrsiAkciju(akcijaId: number | string, rashodNaAkciji: number) {
  const res = await api.post<ZavrsiAkcijaResponse>(`/api/akcije/${akcijaId}/zavrsi`, { rashodNaAkciji })
  return res.data
}

export async function regenerateAkcijaInviteLink(akcijaId: number | string) {
  const res = await api.post<{ inviteUrl?: string }>(`/api/akcije/${akcijaId}/invite-link/regenerate`)
  return res.data
}

export async function createAkcija(formData: FormData) {
  const res = await api.post('/api/akcije', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function updateAkcija(id: number | string, formData: FormData) {
  await api.patch(`/api/akcije/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function geocodeQuery(q: string) {
  const res = await api.get<{ lat: number; lng: number }>('/api/geocode', { params: { q } })
  return res.data
}

export async function fetchEligibleClubMembers(
  akcijaId: number,
  params: { q?: string; offset?: number; limit?: number },
) {
  const res = await api.get<{ users: ExternalUserCandidate[] }>(
    `/api/akcije/${akcijaId}/eligible-club-members`,
    { params },
  )
  return res.data.users ?? []
}

export async function addClubMembersCompleted(
  akcijaId: number,
  payload: { korisnikIds: number[] },
) {
  const res = await api.post(`/api/akcije/${akcijaId}/add-club-members-completed`, payload)
  return res.data
}

export async function fetchMojePopeoSe() {
  const res = await api.get('/api/moje-popeo-se')
  return res.data
}
