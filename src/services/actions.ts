import api from './api'
import type { AkcijaListItem } from '../types/akcija'
import type { KorisnikRef } from '../types/korisnik'
import {
  addClubMembersCompleted as addClubMembersCompletedShared,
  cancelParticipationRequest as cancelParticipationRequestShared,
  cancelSignupRequest as cancelSignupRequestShared,
  createAkcija as createAkcijaShared,
  createParticipationRequest as createParticipationRequestShared,
  deleteAkcija as deleteAkcijaShared,
  deletePrijava as deletePrijavaShared,
  dodajClanaPopeoSe as dodajClanaPopeoSeShared,
  dodajPrevoz as dodajPrevozShared,
  fetchActionParticipationRequests as fetchActionParticipationRequestsShared,
  fetchActionSignupRequestById as fetchActionSignupRequestByIdShared,
  fetchActionSignupRequests as fetchActionSignupRequestsShared,
  fetchAkcijaById as fetchAkcijaByIdShared,
  fetchAkcije as fetchAkcijeShared,
  fetchEligibleClubMembers as fetchEligibleClubMembersShared,
  fetchEligibleExternalUsers as fetchEligibleExternalUsersShared,
  fetchMojaPrijavaZaAkciju as fetchMojaPrijavaZaAkcijuShared,
  fetchMojePopeoSe as fetchMojePopeoSeShared,
  fetchMojePrijave as fetchMojePrijaveShared,
  fetchPrijaveZaAkciju as fetchPrijaveZaAkcijuShared,
  geocodeQuery as geocodeQueryShared,
  markPrijavePlatio as markPrijavePlatioShared,
  obrisiPrevoz as obrisiPrevozShared,
  otkaziPrijavu as otkaziPrijavuShared,
  prijaviNaAkciju as prijaviNaAkcijuShared,
  regenerateAkcijaInviteLink as regenerateAkcijaInviteLinkShared,
  respondToActionSignupRequest as respondToActionSignupRequestShared,
  updateAkcija as updateAkcijaShared,
  updateMojaPrijava as updateMojaPrijavaShared,
  updatePrijavaPlatio as updatePrijavaPlatioShared,
  updatePrijavaStatus as updatePrijavaStatusShared,
  zavrsiAkciju as zavrsiAkcijuShared,
  type ActionParticipationRequest as SharedActionParticipationRequest,
  type ExternalUserCandidate as SharedExternalUserCandidate,
  type ZavrsiAkcijaResponse as SharedZavrsiAkcijaResponse,
} from '@beleg/shared/services'

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

export interface MojaSignupRequestPayload {
  id: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt?: string
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: Array<{ rentId: number; kolicina: number }>
}

export interface MojaPrijavaResponse {
  prijava: MojaPrijavaPayload | null
  signupRequest?: MojaSignupRequestPayload | null
}

export interface ActionSignupRequest {
  id: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
  respondedAt?: string
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: Array<{ rentId: number; kolicina: number }>
  requester: KorisnikRef & { avatarUrl?: string; isProfiGuide?: boolean }
  action?: {
    id: number
    naziv?: string
    datum?: string
    planina?: string
    vrh?: string
  }
}

export type ActionParticipationRequest = SharedActionParticipationRequest
export type ExternalUserCandidate = SharedExternalUserCandidate
export type ZavrsiAkcijaResponse = SharedZavrsiAkcijaResponse

export interface PrijaviNaAkcijuResponse {
  message?: string
}

export interface AddClubMembersCompletedResponse {
  added?: number
  updated?: number
  skipped?: number
  processed?: number
  newlySummited?: number
}

function inviteOptions(config?: { params?: Record<string, string> }) {
  const inviteToken = config?.params?.inviteToken
  return inviteToken ? { inviteToken } : undefined
}

export async function fetchAkcije(options?: { scope?: string }) {
  return fetchAkcijeShared(api, options)
}

export async function fetchMojePrijave() {
  return fetchMojePrijaveShared(api)
}

export async function fetchAkcijaById(id: number | string, inviteToken?: string) {
  return fetchAkcijaByIdShared(api, id, inviteToken)
}

export async function fetchPrijaveZaAkciju(id: number | string) {
  return fetchPrijaveZaAkcijuShared(api, id)
}

export async function fetchMojaPrijavaZaAkciju(id: number | string) {
  return fetchMojaPrijavaZaAkcijuShared(api, id)
}

export async function prijaviNaAkciju(
  id: number | string,
  payload?: Record<string, unknown>,
  config?: { params?: Record<string, string> },
): Promise<PrijaviNaAkcijuResponse> {
  return prijaviNaAkcijuShared(api, id, payload, inviteOptions(config)) as Promise<PrijaviNaAkcijuResponse>
}

export async function updateMojaPrijava(
  id: number | string,
  payload: Record<string, unknown>,
  config?: { params?: Record<string, string> },
) {
  return updateMojaPrijavaShared(api, id, payload, inviteOptions(config))
}

export async function otkaziPrijavu(id: number | string) {
  return otkaziPrijavuShared(api, id)
}

export async function cancelSignupRequest(akcijaId: number | string) {
  return cancelSignupRequestShared(api, akcijaId)
}

export async function fetchActionSignupRequests(akcijaId: number | string, status = 'pending') {
  return fetchActionSignupRequestsShared(api, akcijaId, status)
}

export async function fetchActionSignupRequestById(akcijaId: number | string, requestId: number | string) {
  return fetchActionSignupRequestByIdShared(api, akcijaId, requestId)
}

export async function respondToActionSignupRequest(
  akcijaId: number | string,
  requestId: number | string,
  action: 'accept' | 'reject',
) {
  return respondToActionSignupRequestShared(api, akcijaId, requestId, action)
}

export async function deleteAkcija(id: number | string) {
  return deleteAkcijaShared(api, id)
}

export async function dodajPrevoz(id: number | string, data: Record<string, unknown>) {
  return dodajPrevozShared(api, id, data as Parameters<typeof dodajPrevozShared>[2])
}

export async function obrisiPrevoz(akcijaId: number | string, prevozId: number) {
  return obrisiPrevozShared(api, akcijaId, prevozId)
}

export async function updatePrijavaStatus(prijavaId: number, status: string) {
  return updatePrijavaStatusShared(api, prijavaId, status)
}

export async function updatePrijavaPlatio(prijavaId: number, platio: boolean) {
  return updatePrijavaPlatioShared(api, prijavaId, platio)
}

export async function markPrijavePlatio(prijavaIds: number[]) {
  return markPrijavePlatioShared(api, prijavaIds)
}

export async function deletePrijava(prijavaId: number) {
  return deletePrijavaShared(api, prijavaId)
}

export async function dodajClanaPopeoSe(akcijaId: number | string, korisnikId: number) {
  return dodajClanaPopeoSeShared(api, akcijaId, korisnikId)
}

export async function cancelParticipationRequest(akcijaId: number | string, requestId: number) {
  return cancelParticipationRequestShared(api, akcijaId, requestId)
}

export async function fetchParticipationRequests(akcijaId: number | string) {
  return fetchActionParticipationRequestsShared(api, akcijaId)
}

export async function createParticipationRequest(akcijaId: number | string, targetUserId: number) {
  return createParticipationRequestShared(api, akcijaId, targetUserId)
}

export async function fetchEligibleExternalUsers(
  akcijaId: number | string,
  params: { scope: string; q?: string; offset?: number; limit?: number },
) {
  return fetchEligibleExternalUsersShared(api, akcijaId, params)
}

export async function zavrsiAkciju(akcijaId: number | string, rashodNaAkciji: number) {
  return zavrsiAkcijuShared(api, akcijaId, rashodNaAkciji)
}

export async function regenerateAkcijaInviteLink(akcijaId: number | string) {
  return regenerateAkcijaInviteLinkShared(api, akcijaId)
}

export async function createAkcija(formData: FormData) {
  return createAkcijaShared(api, formData)
}

export async function updateAkcija(id: number | string, formData: FormData) {
  return updateAkcijaShared(api, id, formData)
}

export async function geocodeQuery(q: string) {
  return geocodeQueryShared(api, q)
}

export async function fetchEligibleClubMembers(
  akcijaId: number,
  params: { q?: string; offset?: number; limit?: number },
) {
  return fetchEligibleClubMembersShared(api, akcijaId, params)
}

export async function addClubMembersCompleted(akcijaId: number, payload: { korisnikIds: number[] }) {
  return addClubMembersCompletedShared(api, akcijaId, payload) as Promise<AddClubMembersCompletedResponse>
}

export async function fetchMojePopeoSe() {
  return fetchMojePopeoSeShared(api)
}
