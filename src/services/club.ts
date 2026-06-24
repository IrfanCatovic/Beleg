import api from './api'
import type { KlubData, ClubAdminStats, ClubJoinRequestItem } from '../types/klub'
import {
  cancelJoinRequest as cancelJoinRequestShared,
  createJoinRequest as createJoinRequestShared,
  fetchClubJoinRequests as fetchClubJoinRequestsShared,
  fetchKlub as fetchKlubShared,
  fetchKlubAdminStats as fetchKlubAdminStatsShared,
  fetchKlubByNaziv as fetchKlubByNazivShared,
  fetchMyJoinRequests as fetchMyJoinRequestsShared,
  leaveClub as leaveClubShared,
  respondClubJoinRequest as respondClubJoinRequestShared,
  searchKlubovi as searchKluboviShared,
  updateKlub as updateKlubShared,
  updateKlubLogo as updateKlubLogoShared,
} from '@beleg/shared/services'

export type { KlubData, ClubAdminStats, ClubJoinRequestItem }

export interface KlubInfo {
  id: number
  naziv: string
  logoUrl?: string
  valuta?: string
  [key: string]: unknown
}

export async function fetchKlub() {
  return fetchKlubShared(api)
}

export async function fetchKlubByNaziv(naziv: string) {
  return fetchKlubByNazivShared(api, naziv)
}

export async function updateKlub(payload: Record<string, unknown>) {
  return updateKlubShared(api, payload)
}

export async function updateKlubLogo(formData: FormData) {
  return updateKlubLogoShared(api, formData)
}

export async function fetchKlubAdminStats() {
  return fetchKlubAdminStatsShared(api)
}

export async function fetchClubJoinRequests(status = 'pending') {
  return fetchClubJoinRequestsShared(api, status)
}

export async function respondClubJoinRequest(requestId: number, action: 'accept' | 'reject' | 'block') {
  return respondClubJoinRequestShared(api, requestId, action)
}

export async function leaveClub() {
  return leaveClubShared(api)
}

export async function searchKlubovi(search?: string) {
  return searchKluboviShared(api, search)
}

export async function fetchMyJoinRequests() {
  return fetchMyJoinRequestsShared(api)
}

export async function createJoinRequest(clubId: number) {
  return createJoinRequestShared(api, clubId)
}

export async function cancelJoinRequest(requestId: number) {
  return cancelJoinRequestShared(api, requestId)
}
